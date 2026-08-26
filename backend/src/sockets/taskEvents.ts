import type { TaskResponse } from "../services/task.service";
import { getSocketServer } from "./io";

/** Emits a task event to the project room, silently no-ops if Socket.IO is unavailable. */
function emitToProject(projectId: string, event: string, payload: unknown): void {
  const io = getSocketServer();
  if (!io) return;
  io.to(`project:${projectId}`).emit(event, payload);
}

/** Broadcasts that a new task was created in a project. */
export function emitTaskCreated(projectId: string, task: TaskResponse): void {
  emitToProject(projectId, "task.created", task);
}

/** Broadcasts that a task was updated in a project. */
export function emitTaskUpdated(projectId: string, task: TaskResponse): void {
  emitToProject(projectId, "task.updated", task);
}

/** Broadcasts that a task was deleted from a project. */
export function emitTaskDeleted(projectId: string, taskId: string): void {
  emitToProject(projectId, "task.deleted", { id: taskId });
}
