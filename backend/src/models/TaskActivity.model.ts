import { model, Schema, type Types } from "mongoose";

export const TASK_ACTIVITY_ACTOR_TYPES = ["user", "agent", "system"] as const;
export const TASK_ACTIVITY_TYPES = [
  "created",
  "extracted",
  "approved",
  "column_changed",
  "deadline_changed",
  "assignee_changed",
  "priority_changed",
  "duplicate_resolved"
] as const;

export type TaskActivityActorType = (typeof TASK_ACTIVITY_ACTOR_TYPES)[number];
export type TaskActivityType = (typeof TASK_ACTIVITY_TYPES)[number];

/** An immutable audit event explaining how and why a task changed. */
export interface TaskActivityDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  taskId: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorType: TaskActivityActorType;
  type: TaskActivityType;
  fromValue?: unknown;
  toValue?: unknown;
  createdAt: Date;
}

const taskActivitySchema = new Schema<TaskActivityDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    actorType: { type: String, enum: TASK_ACTIVITY_ACTOR_TYPES, required: true },
    type: { type: String, enum: TASK_ACTIVITY_TYPES, required: true },
    fromValue: { type: Schema.Types.Mixed },
    toValue: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Activity feeds are always loaded newest-first for one task or project.
taskActivitySchema.index({ projectId: 1, taskId: 1, createdAt: -1 });

export const TaskActivity = model<TaskActivityDocument>("TaskActivity", taskActivitySchema);
