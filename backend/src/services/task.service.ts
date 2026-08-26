import mongoose, { type ClientSession, type Types } from "mongoose";
import { emitTaskCreated, emitTaskDeleted, emitTaskUpdated } from "../sockets/taskEvents";
import { Membership } from "../models/Membership.model";
import { Project, type KanbanColumn } from "../models/Project.model";
import {
  Task,
  type TaskDocument,
  type TaskPriority,
  type TaskSource
} from "../models/Task.model";
import {
  TaskActivity,
  type TaskActivityDocument,
  type TaskActivityType
} from "../models/TaskActivity.model";
import { ApiError } from "../utils/ApiError";
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput
} from "../validators/task.validator";

export interface TaskSourceResponse {
  meetingId: string;
  segmentId?: string;
  quote?: string;
  timestampMs?: number;
}

export interface TaskResponse {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: Date;
  priority: TaskPriority;
  columnId: string;
  source?: TaskSourceResponse;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskActivityResponse {
  id: string;
  projectId: string;
  taskId: string;
  actorId?: string;
  actorType: TaskActivityDocument["actorType"];
  type: TaskActivityDocument["type"];
  fromValue?: unknown;
  toValue?: unknown;
  createdAt: Date;
}

export interface GroupedTasksResponse {
  columns: Array<KanbanColumn & { tasks: TaskResponse[] }>;
}

interface PendingActivity {
  projectId: string;
  taskId: Types.ObjectId;
  actorId: string;
  actorType: "user";
  type: TaskActivityType;
  fromValue?: unknown;
  toValue?: unknown;
}

interface TaskListFilter {
  projectId: string;
  columnId?: string;
  assigneeId?: string;
  priority?: TaskPriority;
  dueDate?: { $gte?: Date; $lte?: Date };
  $or?: Array<{ title: RegExp } | { description: RegExp }>;
}

/** Converts the nested source reference into safe string identifiers for clients. */
function serializeSource(source: TaskSource): TaskSourceResponse {
  return {
    meetingId: source.meetingId.toString(),
    ...(source.segmentId ? { segmentId: source.segmentId.toString() } : {}),
    ...(source.quote ? { quote: source.quote } : {}),
    ...(source.timestampMs !== undefined ? { timestampMs: source.timestampMs } : {})
  };
}

/** Converts a Mongoose task into the stable frontend response shape. */
function serializeTask(task: TaskDocument): TaskResponse {
  return {
    id: task._id.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    ...(task.assigneeId ? { assigneeId: task.assigneeId.toString() } : {}),
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    priority: task.priority,
    columnId: task.columnId,
    ...(task.source ? { source: serializeSource(task.source) } : {}),
    createdBy: task.createdBy.toString(),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

/** Converts an immutable audit record into its API representation. */
function serializeActivity(activity: TaskActivityDocument): TaskActivityResponse {
  return {
    id: activity._id.toString(),
    projectId: activity.projectId.toString(),
    taskId: activity.taskId.toString(),
    ...(activity.actorId ? { actorId: activity.actorId.toString() } : {}),
    actorType: activity.actorType,
    type: activity.type,
    ...(activity.fromValue !== undefined ? { fromValue: activity.fromValue } : {}),
    ...(activity.toValue !== undefined ? { toValue: activity.toValue } : {}),
    createdAt: activity.createdAt
  };
}

/** Prevents assigning a task to a user outside the task's project. */
async function assertProjectAssignee(projectId: string, assigneeId: string): Promise<void> {
  const membership = await Membership.exists({ projectId, userId: assigneeId });
  if (!membership) {
    throw new ApiError(400, "VALIDATION_ERROR", "The assignee must be a project member.");
  }
}

/** Loads the board definition used to validate stable task column references. */
async function loadProjectColumns(
  projectId: string,
  session?: ClientSession
): Promise<KanbanColumn[]> {
  const projectQuery = Project.findById(projectId, { kanbanColumns: 1 });
  if (session) projectQuery.session(session);
  const project = await projectQuery.lean();
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project was not found.");
  return [...project.kanbanColumns].sort((left, right) => left.order - right.order);
}

/** Resolves an explicit column or the board's first Todo-category default. */
function resolveColumnId(columns: KanbanColumn[], requestedColumnId?: string): string {
  if (requestedColumnId) {
    if (!columns.some((column) => column.id === requestedColumnId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "The Kanban column does not belong to this project.");
    }
    return requestedColumnId;
  }

  const defaultColumn = columns.find((column) => column.category === "todo");
  if (!defaultColumn) {
    throw new ApiError(409, "CONFLICT", "The project does not have a Todo-category column.");
  }
  return defaultColumn.id;
}

/** Escapes user search text before placing it inside a MongoDB regular expression. */
function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Creates a task and its initial activity event in one transaction. */
export async function createTask(
  projectId: string,
  userId: string,
  input: CreateTaskInput
): Promise<TaskResponse> {
  if (input.assigneeId) await assertProjectAssignee(projectId, input.assigneeId);

  let createdTask: TaskDocument | undefined;
  await mongoose.connection.transaction(async (session) => {
    const columns = await loadProjectColumns(projectId, session);
    const columnId = resolveColumnId(columns, input.columnId);
    const [task] = await Task.create(
      [
        {
          projectId,
          title: input.title,
          ...(input.description ? { description: input.description } : {}),
          ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
          ...(input.dueDate ? { dueDate: input.dueDate } : {}),
          priority: input.priority,
          columnId,
          createdBy: userId
        }
      ],
      { session }
    );
    if (!task) throw new ApiError(500, "INTERNAL_ERROR", "Task creation failed.");

    await TaskActivity.create(
      [
        {
          projectId,
          taskId: task._id,
          actorId: userId,
          actorType: "user",
          type: "created",
          toValue: { title: task.title, columnId: task.columnId }
        }
      ],
      { session }
    );
    createdTask = task;
  });

  if (!createdTask) throw new ApiError(500, "INTERNAL_ERROR", "Task creation failed.");
  const response = serializeTask(createdTask);
  emitTaskCreated(projectId, response);
  return response;
}

/** Lists project tasks using optional board filters and safe text matching. */
export async function listTasks(
  projectId: string,
  query: ListTasksQuery
): Promise<TaskResponse[] | GroupedTasksResponse> {
  const filter: TaskListFilter = { projectId };
  const columns = await loadProjectColumns(projectId);
  if (query.columnId) {
    resolveColumnId(columns, query.columnId);
    filter.columnId = query.columnId;
  }
  if (query.assignee) filter.assigneeId = query.assignee;
  if (query.priority) filter.priority = query.priority;
  if (query.dueAfter || query.dueBefore) {
    filter.dueDate = {
      ...(query.dueAfter ? { $gte: new Date(query.dueAfter) } : {}),
      ...(query.dueBefore ? { $lte: new Date(query.dueBefore) } : {})
    };
  }
  if (query.q) {
    const search = new RegExp(escapeRegularExpression(query.q), "i");
    filter.$or = [{ title: search }, { description: search }];
  }

  const tasks = (await Task.find(filter).sort({ createdAt: -1 })).map(serializeTask);
  if (query.groupBy !== "column") return tasks;

  return {
    columns: columns.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.columnId === column.id)
    }))
  };
}

/** Loads one task only when it belongs to the authorized project. */
export async function getTask(projectId: string, taskId: string): Promise<TaskResponse> {
  const task = await Task.findOne({ _id: taskId, projectId });
  if (!task) throw new ApiError(404, "NOT_FOUND", "Task was not found.");
  return serializeTask(task);
}

/** Records audit entries for task fields whose changes have dedicated activity types. */
function collectUpdateActivities(
  task: TaskDocument,
  projectId: string,
  userId: string,
  input: UpdateTaskInput
): PendingActivity[] {
  const activities: PendingActivity[] = [];
  const add = (type: TaskActivityType, fromValue: unknown, toValue: unknown): void => {
    if (fromValue !== toValue) {
      activities.push({ projectId, taskId: task._id, actorId: userId, actorType: "user", type, fromValue, toValue });
    }
  };

  if (input.columnId !== undefined) add("column_changed", task.columnId, input.columnId);
  if (input.priority !== undefined) add("priority_changed", task.priority, input.priority);
  if (input.assigneeId !== undefined) {
    add("assignee_changed", task.assigneeId?.toString() ?? null, input.assigneeId);
  }
  if (input.dueDate !== undefined) {
    add("deadline_changed", task.dueDate?.toISOString() ?? null, input.dueDate?.toISOString() ?? null);
  }
  return activities;
}

/** Updates a project task and atomically appends its field-level activity events. */
export async function updateTask(
  projectId: string,
  taskId: string,
  userId: string,
  input: UpdateTaskInput
): Promise<TaskResponse> {
  if (input.assigneeId) await assertProjectAssignee(projectId, input.assigneeId);

  let updatedTask: TaskDocument | null = null;
  await mongoose.connection.transaction(async (session) => {
    if (input.columnId) resolveColumnId(await loadProjectColumns(projectId, session), input.columnId);
    const existingTask = await Task.findOne({ _id: taskId, projectId }).session(session);
    if (!existingTask) throw new ApiError(404, "NOT_FOUND", "Task was not found.");

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    for (const field of ["title", "priority", "columnId"] as const) {
      if (input[field] !== undefined) $set[field] = input[field];
    }
    for (const field of ["description", "assigneeId", "dueDate"] as const) {
      if (input[field] === null) $unset[field] = 1;
      else if (input[field] !== undefined) $set[field] = input[field];
    }

    const activities = collectUpdateActivities(existingTask, projectId, userId, input);
    const update = {
      ...(Object.keys($set).length > 0 ? { $set } : {}),
      ...(Object.keys($unset).length > 0 ? { $unset } : {})
    };
    updatedTask = await Task.findOneAndUpdate({ _id: taskId, projectId }, update, {
      returnDocument: "after",
      runValidators: true,
      session
    });
    if (!updatedTask) throw new ApiError(404, "NOT_FOUND", "Task was not found.");
    if (activities.length > 0) await TaskActivity.insertMany(activities, { session });
  });

  if (!updatedTask) throw new ApiError(500, "INTERNAL_ERROR", "Task update failed.");
  const response = serializeTask(updatedTask);
  emitTaskUpdated(projectId, response);
  return response;
}

/** Deletes a task and its dependent activity history after route-level authorization. */
export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    const task = await Task.findOneAndDelete({ _id: taskId, projectId }, { session });
    if (!task) throw new ApiError(404, "NOT_FOUND", "Task was not found.");
    await TaskActivity.deleteMany({ projectId, taskId }, { session });
  });
  emitTaskDeleted(projectId, taskId);
}

/** Returns the immutable audit trail for one task in chronological order. */
export async function listTaskActivity(
  projectId: string,
  taskId: string
): Promise<TaskActivityResponse[]> {
  const taskExists = await Task.exists({ _id: taskId, projectId });
  if (!taskExists) throw new ApiError(404, "NOT_FOUND", "Task was not found.");
  // ObjectId order breaks ties when several activity records share one millisecond.
  const activities = await TaskActivity.find({ projectId, taskId }).sort({ createdAt: 1, _id: 1 });
  return activities.map(serializeActivity);
}
