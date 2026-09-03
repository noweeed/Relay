import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export const AI_JOB_OUTCOMES = ["persisted", "ignored_stale"] as const;
export type AiJobOutcome = (typeof AI_JOB_OUTCOMES)[number];

interface AiJobLedgerFields {
  jobId: string;
  projectId: Types.ObjectId;
  resourceId: Types.ObjectId;
  outcome: AiJobOutcome;
  appliedAt: Date;
}

export type AiJobLedgerDocument = HydratedDocument<AiJobLedgerFields>;

const aiJobLedgerSchema = new Schema<AiJobLedgerFields>(
  {
    jobId: { type: String, required: true, unique: true, trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    outcome: { type: String, enum: AI_JOB_OUTCOMES, required: true },
    appliedAt: { type: Date, required: true, default: Date.now }
  },
  { versionKey: false }
);

aiJobLedgerSchema.index({ resourceId: 1, appliedAt: -1 });

/** Durable idempotency record proving that one AI result has already been applied. */
export const AiJobLedger = model<AiJobLedgerFields>("AiJobLedger", aiJobLedgerSchema);
