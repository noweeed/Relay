import { model, Schema, type Types } from "mongoose";
import { TASK_PRIORITIES, type TaskPriority } from "./Task.model";

export const TASK_CANDIDATE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "duplicate_pending"
] as const;

export type TaskCandidateStatus = (typeof TASK_CANDIDATE_STATUSES)[number];

/** An AI proposal that requires human review before it can become a real task. */
export interface TaskCandidateDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  meetingId: Types.ObjectId;
  segmentId?: Types.ObjectId;
  title: string;
  description?: string;
  suggestedAssigneeId?: Types.ObjectId;
  suggestedDueDate?: Date;
  suggestedPriority: TaskPriority;
  sourceQuote: string;
  confidence?: number;
  status: TaskCandidateStatus;
  sourceJobId: string;
  sourceTaskIndex: number;
  createdTaskId?: Types.ObjectId;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const taskCandidateSchema = new Schema<TaskCandidateDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    segmentId: { type: Schema.Types.ObjectId, ref: "TranscriptSegment" },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5_000 },
    suggestedAssigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    suggestedDueDate: Date,
    suggestedPriority: { type: String, enum: TASK_PRIORITIES, required: true, default: "medium" },
    sourceQuote: { type: String, required: true, trim: true, maxlength: 2_000 },
    // Confidence and embeddings guide internal AI behavior and must not be selected by normal reads.
    confidence: { type: Number, min: 0, max: 1, select: false },
    status: { type: String, enum: TASK_CANDIDATE_STATUSES, required: true, default: "pending" },
    // These fields make replaying the same Redis result safe and idempotent.
    sourceJobId: { type: String, required: true, trim: true },
    sourceTaskIndex: { type: Number, required: true, min: 0 },
    createdTaskId: { type: Schema.Types.ObjectId, ref: "Task" },
    embedding: { type: [Number], select: false }
  },
  { timestamps: true, versionKey: false }
);

taskCandidateSchema.index({ projectId: 1, meetingId: 1, status: 1, createdAt: 1 });
taskCandidateSchema.index(
  { sourceJobId: 1, sourceTaskIndex: 1 },
  { unique: true, sparse: true }
);

export const TaskCandidate = model<TaskCandidateDocument>("TaskCandidate", taskCandidateSchema);
