import { randomUUID } from "node:crypto";
import { model, Schema, type Types } from "mongoose";

export const KANBAN_COLUMN_CATEGORIES = ["todo", "in_progress", "done"] as const;
export type KanbanColumnCategory = (typeof KANBAN_COLUMN_CATEGORIES)[number];

/** A stable project-specific workflow stage displayed as one Kanban column. */
export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  category: KanbanColumnCategory;
  order: number;
}

/** Creates an independent default board for each new or migrated project. */
export function createDefaultKanbanColumns(): KanbanColumn[] {
  return [
    { id: randomUUID(), name: "Todo", color: "#64748B", category: "todo", order: 0 },
    { id: randomUUID(), name: "In Progress", color: "#3B82F6", category: "in_progress", order: 1 },
    { id: randomUUID(), name: "Done", color: "#22C55E", category: "done", order: 2 }
  ];
}

/** A Relay workspace that owns meetings, tasks, and memberships. */
export interface ProjectDocument {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  kanbanColumns: KanbanColumn[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const kanbanColumnSchema = new Schema<KanbanColumn>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    color: { type: String, required: true, match: /^#[A-F\d]{6}$/i },
    category: { type: String, enum: KANBAN_COLUMN_CATEGORIES, required: true },
    order: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const projectSchema = new Schema<ProjectDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1_000 },
    kanbanColumns: { type: [kanbanColumnSchema], required: true, default: createDefaultKanbanColumns },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true, versionKey: false }
);

export const Project = model<ProjectDocument>("Project", projectSchema);
