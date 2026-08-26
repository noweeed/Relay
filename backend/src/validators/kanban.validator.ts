import { z } from "zod";
import { KANBAN_COLUMN_CATEGORIES } from "../models/Project.model";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Enter a valid resource ID.");
const columnId = z.uuid("Enter a valid Kanban column ID.");
const columnName = z.string().trim().min(2).max(40);
const columnColor = z.string().regex(/^#[A-F\d]{6}$/i, "Use a six-digit hex color such as #3B82F6.");

export const kanbanProjectParamsSchema = z.object({ projectId: objectId });
export const kanbanColumnParamsSchema = z.object({ projectId: objectId, columnId });

export const createKanbanColumnSchema = z.object({
  name: columnName,
  color: columnColor.default("#64748B"),
  category: z.enum(KANBAN_COLUMN_CATEGORIES)
});

export const updateKanbanColumnSchema = z
  .object({
    name: columnName.optional(),
    color: columnColor.optional(),
    category: z.enum(KANBAN_COLUMN_CATEGORIES).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one column field to update.");

export const reorderKanbanColumnsSchema = z.object({
  columnIds: z
    .array(columnId)
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, "Column IDs must not repeat.")
});

export const deleteKanbanColumnQuerySchema = z.object({
  moveTasksToColumnId: columnId.optional()
});

export type CreateKanbanColumnInput = z.infer<typeof createKanbanColumnSchema>;
export type UpdateKanbanColumnInput = z.infer<typeof updateKanbanColumnSchema>;
export type ReorderKanbanColumnsInput = z.infer<typeof reorderKanbanColumnsSchema>;
export type DeleteKanbanColumnQuery = z.infer<typeof deleteKanbanColumnQuerySchema>;
