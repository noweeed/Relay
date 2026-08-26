import type { Request, Response } from "express";
import * as taskService from "../services/task.service";
import { ApiError } from "../utils/ApiError";
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput
} from "../validators/task.validator";

/** Reads the trusted identities installed by authentication and membership middleware. */
function getTaskContext(request: Request): { userId: string; projectId: string } {
  if (!request.user || !request.projectMembership) {
    throw new ApiError(500, "INTERNAL_ERROR", "Task authorization context is missing.");
  }
  return {
    userId: request.user.id,
    projectId: request.projectMembership.projectId
  };
}

/** Reads the validated task identifier from route parameters. */
function getTaskId(request: Request): string {
  const taskId = request.params.taskId;
  if (typeof taskId !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid task ID is required.");
  }
  return taskId;
}

/** Creates a manual task for the authenticated project member. */
export async function createTask(request: Request, response: Response): Promise<void> {
  const context = getTaskContext(request);
  const task = await taskService.createTask(
    context.projectId,
    context.userId,
    request.body as CreateTaskInput
  );
  response.status(201).json({ success: true, data: task });
}

/** Lists filtered tasks or an ordered custom-column Kanban response. */
export async function listTasks(request: Request, response: Response): Promise<void> {
  const context = getTaskContext(request);
  const tasks = await taskService.listTasks(
    context.projectId,
    request.query as unknown as ListTasksQuery
  );
  response.json({ success: true, data: tasks });
}

/** Returns one task from the authorized project. */
export async function getTask(request: Request, response: Response): Promise<void> {
  const context = getTaskContext(request);
  const task = await taskService.getTask(context.projectId, getTaskId(request));
  response.json({ success: true, data: task });
}

/** Applies member edits and records relevant audit events. */
export async function updateTask(request: Request, response: Response): Promise<void> {
  const context = getTaskContext(request);
  const task = await taskService.updateTask(
    context.projectId,
    getTaskId(request),
    context.userId,
    request.body as UpdateTaskInput
  );
  response.json({ success: true, data: task });
}

/** Deletes a task after owner/admin authorization at the route boundary. */
export async function deleteTask(request: Request, response: Response): Promise<void> {
  const context = getTaskContext(request);
  await taskService.deleteTask(context.projectId, getTaskId(request));
  response.json({ success: true, data: { deleted: true } });
}

/** Returns the task's immutable activity history. */
export async function listTaskActivity(request: Request, response: Response): Promise<void> {
  const context = getTaskContext(request);
  const activity = await taskService.listTaskActivity(context.projectId, getTaskId(request));
  response.json({ success: true, data: activity });
}
