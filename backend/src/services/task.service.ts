import mongoose, { type ClientSession, type Types } from "mongoose";
import { emitTaskCreated, emitTaskDeleted, emitTaskUpdated } from "../sockets/taskEvents";
import { DuplicateCandidate } from "../models/DuplicateCandidate.model";
import { TaskCandidate } from "../models/TaskCandidate.model";
import { Membership } from "../models/Membership.model";
import { Project, type KanbanColumn } from "../models/Project.model";
import { TaskComment, type TaskCommentDocument } from "../models/TaskComment.model";
import { User } from "../models/User.model";
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
import { queueEmbeddingRefresh } from "./embedding-refresh.service";
import type {
  CreateTaskInput,
  CreateTaskCommentInput,
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
  assigneeIds: string[];
  /** First assignee, returned for older clients during the multi-assignee transition. */
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
  actorName?: string;
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
  assigneeIds?: string;
  $and?: Array<Record<string, unknown>>;
  priority?: TaskPriority;
  dueDate?: { $gte?: Date; $lte?: Date };
  $or?: Array<{ title: RegExp } | { description: RegExp }>;
}

export interface TaskCommentResponse {
  id: string;
  projectId: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Normalizes new arrays and old single-assignee records into one stable list. */
function taskAssigneeIds(task: Pick<TaskDocument, "assigneeIds" | "assigneeId">): string[] {
  const ids = (task.assigneeIds ?? []).map((id) => id.toString());
  if (ids.length === 0 && task.assigneeId) ids.push(task.assigneeId.toString());
  return [...new Set(ids)];
}

function inputAssigneeIds(input: { assigneeIds?: string[]; assigneeId?: string | null }): string[] {
  if (input.assigneeIds !== undefined) return input.assigneeIds;
  return input.assigneeId ? [input.assigneeId] : [];
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
  const assigneeIds = taskAssigneeIds(task);
  return {
    id: task._id.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    assigneeIds,
    ...(assigneeIds[0] ? { assigneeId: assigneeIds[0] } : {}),
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
function serializeActivity(activity: TaskActivityDocument, actorName?: string): TaskActivityResponse {
  return {
    id: activity._id.toString(),
    projectId: activity.projectId.toString(),
    taskId: activity.taskId.toString(),
    ...(activity.actorId ? { actorId: activity.actorId.toString() } : {}),
    actorType: activity.actorType,
    ...(actorName ? { actorName } : {}),
    type: activity.type,
    ...(activity.fromValue !== undefined ? { fromValue: activity.fromValue } : {}),
    ...(activity.toValue !== undefined ? { toValue: activity.toValue } : {}),
    createdAt: activity.createdAt
  };
}

/** Prevents assigning a task to a user outside the task's project. */
async function assertProjectAssignees(
  projectId: string,
  assigneeIds: string[],
  session?: ClientSession,
): Promise<void> {
  if (assigneeIds.length === 0) return;
  const query = Membership.countDocuments({ projectId, userId: { $in: assigneeIds } });
  if (session) query.session(session);
  const count = await query;
  if (count !== assigneeIds.length) {
    throw new ApiError(400, "VALIDATION_ERROR", "Every assignee must be a project member.");
  }
}

/** Allows task mutations and comments only for project leaders or a current assignee. */
export async function assertCanWorkOnTask(
  projectId: string,
  userId: string,
  task: Pick<TaskDocument, "assigneeIds" | "assigneeId">,
  session?: ClientSession,
): Promise<void> {
  const query = Membership.findOne({ projectId, userId }).select({ role: 1 });
  if (session) query.session(session);
  const membership = await query.lean();
  const isLeader = membership?.role === "owner" || membership?.role === "admin";
  if (!isLeader && !taskAssigneeIds(task).includes(userId)) {
    throw new ApiError(403, "FORBIDDEN", "Only an owner, admin, or task assignee can do this.");
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
  const assigneeIds = inputAssigneeIds(input);
  await assertProjectAssignees(projectId, assigneeIds);

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
          assigneeIds,
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
  await queueEmbeddingRefresh({
    projectId,
    initiatingUserId: userId,
    resourceId: response.id,
    resourceKind: "task",
    title: response.title,
    ...(response.description ? { description: response.description } : {}),
  });
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
  if (query.assignee) {
    filter.$and = [{ $or: [{ assigneeIds: query.assignee }, { assigneeId: query.assignee }] }];
  }
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
  if (input.title !== undefined) add("title_changed", task.title, input.title);
  if (input.description !== undefined) {
    add("description_changed", task.description ?? null, input.description ?? null);
  }
  if (input.priority !== undefined) add("priority_changed", task.priority, input.priority);
  if (input.assigneeIds !== undefined || input.assigneeId !== undefined) {
    add("assignee_changed", taskAssigneeIds(task), inputAssigneeIds(input));
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
  let response: TaskResponse | undefined;
  await mongoose.connection.transaction(async (session) => {
    response = await updateTaskInSession(projectId, taskId, userId, input, session);
  });

  if (!response) throw new ApiError(500, "INTERNAL_ERROR", "Task update failed.");
  emitTaskUpdated(projectId, response);
  if (input.title !== undefined || input.description !== undefined) {
    await queueEmbeddingRefresh({
      projectId,
      initiatingUserId: userId,
      resourceId: response.id,
      resourceKind: "task",
      title: response.title,
      ...(response.description ? { description: response.description } : {}),
    });
  }
  return response;
}

/** Applies a task update inside a caller-owned transaction without emitting before commit. */
export async function updateTaskInSession(
  projectId: string,
  taskId: string,
  userId: string,
  input: UpdateTaskInput,
  session: ClientSession,
): Promise<TaskResponse> {
  const requestedAssigneeIds =
    input.assigneeIds !== undefined || input.assigneeId !== undefined
      ? inputAssigneeIds(input)
      : undefined;
  if (requestedAssigneeIds) await assertProjectAssignees(projectId, requestedAssigneeIds, session);
  if (input.columnId) resolveColumnId(await loadProjectColumns(projectId, session), input.columnId);
  const existingTask = await Task.findOne({ _id: taskId, projectId }).session(session);
  if (!existingTask) throw new ApiError(404, "NOT_FOUND", "Task was not found.");
  await assertCanWorkOnTask(projectId, userId, existingTask, session);

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  for (const field of ["title", "priority", "columnId"] as const) {
    if (input[field] !== undefined) $set[field] = input[field];
  }
  for (const field of ["description", "dueDate"] as const) {
    if (input[field] === null) $unset[field] = 1;
    else if (input[field] !== undefined) $set[field] = input[field];
  }
  if (requestedAssigneeIds) {
    $set.assigneeIds = requestedAssigneeIds;
    $unset.assigneeId = 1;
  }
  if (input.title !== undefined || input.description !== undefined) $unset.embedding = 1;

  const activities = collectUpdateActivities(existingTask, projectId, userId, input);
  const update = {
    ...(Object.keys($set).length > 0 ? { $set } : {}),
    ...(Object.keys($unset).length > 0 ? { $unset } : {}),
  };
  const updatedTask = await Task.findOneAndUpdate({ _id: taskId, projectId }, update, {
    returnDocument: "after",
    runValidators: true,
    session,
  });
  if (!updatedTask) throw new ApiError(404, "NOT_FOUND", "Task was not found.");
  if (activities.length > 0) await TaskActivity.insertMany(activities, { session });
  return serializeTask(updatedTask);
}

/** Deletes a task and its dependent activity history after route-level authorization. */
export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    const task = await Task.findOneAndDelete({ _id: taskId, projectId }, { session });
    if (!task) throw new ApiError(404, "NOT_FOUND", "Task was not found.");
    await TaskActivity.deleteMany({ projectId, taskId }, { session });
    await TaskComment.deleteMany({ projectId, taskId }, { session });
    const duplicates = await DuplicateCandidate.find({
      projectId,
      existingTaskId: taskId,
      resolution: "pending"
    })
      .select({ taskCandidateId: 1 })
      .session(session);
    if (duplicates.length > 0) {
      await TaskCandidate.updateMany(
        { _id: { $in: duplicates.map((duplicate) => duplicate.taskCandidateId) } },
        { $set: { status: "pending" } },
        { session }
      );
    }
    await DuplicateCandidate.deleteMany({ projectId, existingTaskId: taskId }, { session });
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
  const actorIds = activities.flatMap((activity) => activity.actorId ? [activity.actorId] : []);
  const actors = await User.find({ _id: { $in: actorIds } }, { name: 1 }).lean();
  const names = new Map(actors.map((actor) => [actor._id.toString(), actor.name]));
  return activities.map((activity) =>
    serializeActivity(activity, activity.actorId ? names.get(activity.actorId.toString()) : undefined)
  );
}

function serializeComment(comment: TaskCommentDocument, authorName: string): TaskCommentResponse {
  return {
    id: comment._id.toString(),
    projectId: comment.projectId.toString(),
    taskId: comment.taskId.toString(),
    authorId: comment.authorId.toString(),
    authorName,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

/** Returns comments to any current project member in chronological order. */
export async function listTaskComments(projectId: string, taskId: string): Promise<TaskCommentResponse[]> {
  if (!(await Task.exists({ _id: taskId, projectId }))) {
    throw new ApiError(404, "NOT_FOUND", "Task was not found.");
  }
  const comments = await TaskComment.find({ projectId, taskId }).sort({ createdAt: 1, _id: 1 });
  const authors = await User.find(
    { _id: { $in: comments.map((comment) => comment.authorId) } },
    { name: 1 }
  ).lean();
  const names = new Map(authors.map((author) => [author._id.toString(), author.name]));
  return comments.map((comment) => serializeComment(comment, names.get(comment.authorId.toString()) ?? "Deleted user"));
}

/** Adds a comment and an immutable timeline event in one transaction. */
export async function createTaskComment(
  projectId: string,
  taskId: string,
  userId: string,
  input: CreateTaskCommentInput
): Promise<TaskCommentResponse> {
  let created: TaskCommentDocument | undefined;
  await mongoose.connection.transaction(async (session) => {
    const task = await Task.findOne({ _id: taskId, projectId }).session(session);
    if (!task) throw new ApiError(404, "NOT_FOUND", "Task was not found.");
    await assertCanWorkOnTask(projectId, userId, task, session);
    const [comment] = await TaskComment.create(
      [{ projectId, taskId, authorId: userId, body: input.body }],
      { session }
    );
    if (!comment) throw new ApiError(500, "INTERNAL_ERROR", "Comment creation failed.");
    await TaskActivity.create(
      [{ projectId, taskId, actorId: userId, actorType: "user", type: "commented", toValue: { commentId: comment._id.toString() } }],
      { session }
    );
    created = comment;
  });
  if (!created) throw new ApiError(500, "INTERNAL_ERROR", "Comment creation failed.");
  const author = await User.findById(userId, { name: 1 }).lean();
  return serializeComment(created, author?.name ?? "User");
}
