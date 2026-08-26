import { model, Schema, type Types } from "mongoose";

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Preserves where an extracted task came from, even after people edit the task. */
export interface TaskSource {
  meetingId: Types.ObjectId;
  segmentId?: Types.ObjectId;
  quote?: string;
  timestampMs?: number;
}

/** A project-scoped unit of work displayed on the Relay Kanban board. */
export interface TaskDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  description?: string;
  assigneeId?: Types.ObjectId;
  dueDate?: Date;
  priority: TaskPriority;
  columnId: string;
  source?: TaskSource;
  embedding?: number[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSourceSchema = new Schema<TaskSource>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true },
    segmentId: { type: Schema.Types.ObjectId, ref: "TranscriptSegment" },
    quote: { type: String, trim: true, maxlength: 2_000 },
    timestampMs: { type: Number, min: 0 }
  },
  { _id: false }
);

const taskSchema = new Schema<TaskDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5_000 },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    dueDate: { type: Date, index: true },
    priority: { type: String, enum: TASK_PRIORITIES, required: true, default: "medium" },
    columnId: { type: String, required: true, index: true },
    source: { type: taskSourceSchema },
    // Embeddings are internal search data and should never appear in ordinary API reads.
    embedding: { type: [Number], select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true, versionKey: false }
);

// These compound indexes support the common project board filters efficiently.
taskSchema.index({ projectId: 1, columnId: 1, createdAt: -1 });
taskSchema.index({ projectId: 1, assigneeId: 1, createdAt: -1 });

export const Task = model<TaskDocument>("Task", taskSchema);
