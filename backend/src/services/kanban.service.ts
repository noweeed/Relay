import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession, type HydratedDocument } from "mongoose";
import { Project, type KanbanColumn, type ProjectDocument } from "../models/Project.model";
import { Task } from "../models/Task.model";
import { TaskActivity } from "../models/TaskActivity.model";
import { ApiError } from "../utils/ApiError";
import type {
  CreateKanbanColumnInput,
  DeleteKanbanColumnQuery,
  ReorderKanbanColumnsInput,
  UpdateKanbanColumnInput
} from "../validators/kanban.validator";

const MAX_KANBAN_COLUMNS = 20;

/** Copies one embedded Mongoose column into a plain stable API value. */
function serializeColumn(column: KanbanColumn): KanbanColumn {
  return {
    id: column.id,
    name: column.name,
    color: column.color,
    category: column.category,
    order: column.order
  };
}

/** Returns detached ordered values so callers cannot mutate a Mongoose project accidentally. */
function serializeColumns(columns: KanbanColumn[]): KanbanColumn[] {
  return [...columns].sort((left, right) => left.order - right.order).map(serializeColumn);
}

/** Loads a project for board configuration or fails with the standard resource response. */
async function loadProject(
  projectId: string,
  session?: ClientSession
): Promise<HydratedDocument<ProjectDocument>> {
  const query = Project.findById(projectId);
  if (session) query.session(session);
  const project = await query;
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project was not found.");
  return project;
}

/** Compares display names without allowing duplicates that differ only by letter case. */
function namesMatch(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "base" }) === 0;
}

/** Ensures a new or renamed column has a unique project-local display name. */
function assertUniqueName(project: ProjectDocument, name: string, ignoredColumnId?: string): void {
  const duplicate = project.kanbanColumns.some(
    (column) => column.id !== ignoredColumnId && namesMatch(column.name, name)
  );
  if (duplicate) {
    throw new ApiError(409, "CONFLICT", "A Kanban column with this name already exists.");
  }
}

/** Lists the ordered board definition visible to every project member. */
export async function listKanbanColumns(projectId: string): Promise<KanbanColumn[]> {
  const project = await loadProject(projectId);
  return serializeColumns(project.kanbanColumns);
}

/** Adds one owner/admin-defined workflow stage at the end of the board. */
export async function createKanbanColumn(
  projectId: string,
  input: CreateKanbanColumnInput
): Promise<KanbanColumn> {
  let createdColumn: KanbanColumn | undefined;
  await mongoose.connection.transaction(async (session) => {
    const project = await loadProject(projectId, session);
    if (project.kanbanColumns.length >= MAX_KANBAN_COLUMNS) {
      throw new ApiError(409, "CONFLICT", `A project can contain at most ${MAX_KANBAN_COLUMNS} Kanban columns.`);
    }
    assertUniqueName(project, input.name);

    const column: KanbanColumn = {
      id: randomUUID(),
      name: input.name,
      color: input.color,
      category: input.category,
      order: Math.max(-1, ...project.kanbanColumns.map((candidate) => candidate.order)) + 1
    };
    project.kanbanColumns.push(column);
    await project.save({ session });
    createdColumn = serializeColumn(column);
  });
  if (!createdColumn) throw new ApiError(500, "INTERNAL_ERROR", "Kanban column creation failed.");
  return createdColumn;
}

/** Renames, recolors, or recategorizes a stable column without rewriting its tasks. */
export async function updateKanbanColumn(
  projectId: string,
  columnId: string,
  input: UpdateKanbanColumnInput
): Promise<KanbanColumn> {
  let updatedColumn: KanbanColumn | undefined;
  await mongoose.connection.transaction(async (session) => {
    const project = await loadProject(projectId, session);
    const column = project.kanbanColumns.find((candidate) => candidate.id === columnId);
    if (!column) throw new ApiError(404, "NOT_FOUND", "Kanban column was not found.");
    if (input.name) assertUniqueName(project, input.name, columnId);

    if (
      column.category === "todo" &&
      input.category !== undefined &&
      input.category !== "todo" &&
      project.kanbanColumns.filter((candidate) => candidate.category === "todo").length === 1
    ) {
      throw new ApiError(409, "CONFLICT", "A project must keep at least one Todo-category column.");
    }

    if (input.name !== undefined) column.name = input.name;
    if (input.color !== undefined) column.color = input.color;
    if (input.category !== undefined) column.category = input.category;
    await project.save({ session });
    updatedColumn = serializeColumn(column);
  });
  if (!updatedColumn) throw new ApiError(500, "INTERNAL_ERROR", "Kanban column update failed.");
  return updatedColumn;
}

/** Applies one complete order to prevent duplicate or missing positions during drag-and-drop. */
export async function reorderKanbanColumns(
  projectId: string,
  input: ReorderKanbanColumnsInput
): Promise<KanbanColumn[]> {
  let reorderedColumns: KanbanColumn[] | undefined;
  await mongoose.connection.transaction(async (session) => {
    const project = await loadProject(projectId, session);
    const currentIds = new Set(project.kanbanColumns.map((column) => column.id));
    const includesEveryColumn =
      input.columnIds.length === currentIds.size &&
      input.columnIds.every((columnId) => currentIds.has(columnId));
    if (!includesEveryColumn) {
      throw new ApiError(400, "VALIDATION_ERROR", "Column order must include every current column exactly once.");
    }

    const orderById = new Map(input.columnIds.map((columnId, order) => [columnId, order]));
    for (const column of project.kanbanColumns) column.order = orderById.get(column.id) ?? column.order;
    project.kanbanColumns.sort((left, right) => left.order - right.order);
    await project.save({ session });
    reorderedColumns = serializeColumns(project.kanbanColumns);
  });
  if (!reorderedColumns) throw new ApiError(500, "INTERNAL_ERROR", "Kanban column reorder failed.");
  return reorderedColumns;
}

/** Moves dependent tasks when required and deletes one configurable column atomically. */
export async function deleteKanbanColumn(
  projectId: string,
  columnId: string,
  actorId: string,
  query: DeleteKanbanColumnQuery
): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    const project = await Project.findById(projectId).session(session);
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project was not found.");

    const column = project.kanbanColumns.find((candidate) => candidate.id === columnId);
    if (!column) throw new ApiError(404, "NOT_FOUND", "Kanban column was not found.");
    if (
      column.category === "todo" &&
      project.kanbanColumns.filter((candidate) => candidate.category === "todo").length === 1
    ) {
      throw new ApiError(409, "CONFLICT", "The final Todo-category column cannot be deleted.");
    }

    const destinationId = query.moveTasksToColumnId;
    const destination = destinationId
      ? project.kanbanColumns.find((candidate) => candidate.id === destinationId)
      : undefined;
    if (destinationId === columnId) {
      throw new ApiError(400, "VALIDATION_ERROR", "Tasks must move to a different column.");
    }
    if (destinationId && !destination) {
      throw new ApiError(400, "VALIDATION_ERROR", "The destination column does not belong to this project.");
    }

    const affectedTasks = await Task.find({ projectId, columnId }, { _id: 1 }).session(session);
    if (affectedTasks.length > 0 && !destination) {
      throw new ApiError(409, "CONFLICT", "Choose a destination column before deleting a populated column.");
    }

    if (destination && affectedTasks.length > 0) {
      await Task.updateMany({ projectId, columnId }, { $set: { columnId: destination.id } }, { session });
      await TaskActivity.insertMany(
        affectedTasks.map((task) => ({
          projectId,
          taskId: task._id,
          actorId,
          actorType: "user" as const,
          type: "column_changed" as const,
          fromValue: columnId,
          toValue: destination.id
        })),
        { session }
      );
    }

    project.kanbanColumns = project.kanbanColumns
      .filter((candidate) => candidate.id !== columnId)
      .sort((left, right) => left.order - right.order)
      .map((candidate, order) => ({
        id: candidate.id,
        name: candidate.name,
        color: candidate.color,
        category: candidate.category,
        order
      }));
    await project.save({ session });
  });
}
