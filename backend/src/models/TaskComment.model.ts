import { model, Schema, type Types } from "mongoose";

/** A project-scoped comment attached to one task. */
export interface TaskCommentDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  taskId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskCommentSchema = new Schema<TaskCommentDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2_000 }
  },
  { timestamps: true, versionKey: false }
);

taskCommentSchema.index({ projectId: 1, taskId: 1, createdAt: 1 });

export const TaskComment = model<TaskCommentDocument>("TaskComment", taskCommentSchema);
