import type { Request, Response } from "express";
import * as kanbanService from "../services/kanban.service";
import { ApiError } from "../utils/ApiError";
import type {
  CreateKanbanColumnInput,
  DeleteKanbanColumnQuery,
  ReorderKanbanColumnsInput,
  UpdateKanbanColumnInput
} from "../validators/kanban.validator";

/** Reads the project and user identities established by authorization middleware. */
function getKanbanContext(request: Request): { projectId: string; userId: string } {
  if (!request.projectMembership || !request.user) {
    throw new ApiError(500, "INTERNAL_ERROR", "Kanban authorization context is missing.");
  }
  return { projectId: request.projectMembership.projectId, userId: request.user.id };
}

/** Reads the validated stable column identifier from route parameters. */
function getColumnId(request: Request): string {
  const columnId = request.params.columnId;
  if (typeof columnId !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid Kanban column ID is required.");
  }
  return columnId;
}

/** Returns the board definition to any authorized project member. */
export async function listColumns(request: Request, response: Response): Promise<void> {
  const context = getKanbanContext(request);
  const columns = await kanbanService.listKanbanColumns(context.projectId);
  response.json({ success: true, data: columns });
}

/** Adds a custom workflow column for an owner or admin. */
export async function createColumn(request: Request, response: Response): Promise<void> {
  const context = getKanbanContext(request);
  const column = await kanbanService.createKanbanColumn(
    context.projectId,
    request.body as CreateKanbanColumnInput
  );
  response.status(201).json({ success: true, data: column });
}

/** Updates the display or reporting category of one stable column. */
export async function updateColumn(request: Request, response: Response): Promise<void> {
  const context = getKanbanContext(request);
  const column = await kanbanService.updateKanbanColumn(
    context.projectId,
    getColumnId(request),
    request.body as UpdateKanbanColumnInput
  );
  response.json({ success: true, data: column });
}

/** Replaces the complete board ordering after a drag-and-drop operation. */
export async function reorderColumns(request: Request, response: Response): Promise<void> {
  const context = getKanbanContext(request);
  const columns = await kanbanService.reorderKanbanColumns(
    context.projectId,
    request.body as ReorderKanbanColumnsInput
  );
  response.json({ success: true, data: columns });
}

/** Deletes a column and, when populated, moves its tasks inside the same transaction. */
export async function deleteColumn(request: Request, response: Response): Promise<void> {
  const context = getKanbanContext(request);
  await kanbanService.deleteKanbanColumn(
    context.projectId,
    getColumnId(request),
    context.userId,
    request.query as unknown as DeleteKanbanColumnQuery
  );
  response.json({ success: true, data: { deleted: true } });
}
