import { model, Schema, type Types } from "mongoose";

export const COMMAND_STATUSES = [
  "processing",
  "awaiting_confirmation",
  "ambiguous",
  "executing",
  "completed",
  "cancelled",
  "failed",
] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const COMMAND_INTENTS = [
  "list_overdue_tasks",
  "update_task_status",
  "assign_task",
  "unknown",
] as const;
export type CommandIntent = (typeof COMMAND_INTENTS)[number];

export interface CommandCandidateMatch {
  id: string;
  label: string;
}

/** Audit record for interpretation, confirmation, cancellation, and execution. */
export interface CommandLogDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  status: CommandStatus;
  intent?: CommandIntent;
  parameters?: Record<string, unknown>;
  preview?: string;
  candidateMatches: CommandCandidateMatch[];
  result?: Record<string, unknown>;
  errorMessage?: string;
  activeAiJobId?: string;
  confirmedAt?: Date;
  cancelledAt?: Date;
  executedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const candidateMatchSchema = new Schema<CommandCandidateMatch>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, maxlength: 200 },
  },
  { _id: false },
);

const commandLogSchema = new Schema<CommandLogDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 1_000 },
    status: { type: String, enum: COMMAND_STATUSES, required: true, default: "processing" },
    intent: { type: String, enum: COMMAND_INTENTS },
    parameters: { type: Schema.Types.Mixed },
    preview: { type: String, maxlength: 1_000 },
    candidateMatches: { type: [candidateMatchSchema], default: [] },
    result: { type: Schema.Types.Mixed },
    errorMessage: { type: String, maxlength: 2_000 },
    activeAiJobId: { type: String, index: true },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
    executedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

commandLogSchema.index({ projectId: 1, userId: 1, createdAt: -1 });

export const CommandLog = model<CommandLogDocument>("CommandLog", commandLogSchema);
