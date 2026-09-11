import { z } from "zod";
import { TASK_PRIORITIES } from "../models/Task.model";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Enter a valid resource ID.");
const optionalDescription = z.string().trim().max(5_000).nullable().optional();
const optionalAssignee = objectId.nullable().optional();
const optionalAssignees = z.array(objectId).max(20).refine(
  (ids) => new Set(ids).size === ids.length,
  "Assignees must be unique."
).optional();
const optionalDueDate = z.coerce.date().nullable().optional();

export const taskParamsSchema = z.object({ projectId: objectId, taskId: objectId });

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: optionalDescription,
    assigneeIds: optionalAssignees,
    assigneeId: optionalAssignee,
    dueDate: optionalDueDate,
    priority: z.enum(TASK_PRIORITIES).default("medium"),
    columnId: z.uuid().optional()
  })
  .refine(
    (value) => value.assigneeIds === undefined || value.assigneeId === undefined,
    "Use assigneeIds for multiple assignees."
  );

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: optionalDescription,
    assigneeIds: optionalAssignees,
    assigneeId: optionalAssignee,
    dueDate: optionalDueDate,
    priority: z.enum(TASK_PRIORITIES).optional(),
    columnId: z.uuid().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.")
  .refine(
    (value) => value.assigneeIds === undefined || value.assigneeId === undefined,
    "Use assigneeIds for multiple assignees."
  );

export const createTaskCommentSchema = z.object({
  body: z.string().trim().min(1).max(2_000)
});

export const listTasksQuerySchema = z.object({
  columnId: z.uuid().optional(),
  assignee: objectId.optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueAfter: z.iso.datetime().optional(),
  dueBefore: z.iso.datetime().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  groupBy: z.literal("column").optional()
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
