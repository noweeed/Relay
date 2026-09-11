import { model, Schema, type Types } from "mongoose";

export const DUPLICATE_SIMILARITY_LABELS = ["medium", "high"] as const;
export const DUPLICATE_RESOLUTIONS = [
  "pending",
  "updated_existing",
  "created_separate",
  "ignored"
] as const;

export type DuplicateSimilarityLabel = (typeof DUPLICATE_SIMILARITY_LABELS)[number];
export type DuplicateResolution = (typeof DUPLICATE_RESOLUTIONS)[number];

export interface DuplicateFieldDifference {
  existing?: unknown;
  candidate?: unknown;
}

export interface DuplicateDifferences {
  title?: DuplicateFieldDifference;
  dueDate?: DuplicateFieldDifference;
  assigneeId?: DuplicateFieldDifference;
  priority?: DuplicateFieldDifference;
}

/** A project-scoped possible match that always requires an explicit human decision. */
export interface DuplicateCandidateDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  taskCandidateId: Types.ObjectId;
  existingTaskId: Types.ObjectId;
  similarityLabel: DuplicateSimilarityLabel;
  similarityScore: number;
  differences: DuplicateDifferences;
  resolution: DuplicateResolution;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
}

const fieldDifferenceSchema = new Schema<DuplicateFieldDifference>(
  {
    existing: Schema.Types.Mixed,
    candidate: Schema.Types.Mixed
  },
  { _id: false }
);

const duplicateDifferencesSchema = new Schema<DuplicateDifferences>(
  {
    title: fieldDifferenceSchema,
    dueDate: fieldDifferenceSchema,
    assigneeId: fieldDifferenceSchema,
    priority: fieldDifferenceSchema
  },
  { _id: false }
);

const duplicateCandidateSchema = new Schema<DuplicateCandidateDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    taskCandidateId: {
      type: Schema.Types.ObjectId,
      ref: "TaskCandidate",
      required: true,
      unique: true,
      index: true
    },
    existingTaskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    similarityLabel: {
      type: String,
      enum: DUPLICATE_SIMILARITY_LABELS,
      required: true
    },
    // The raw score guides internal behavior but is never returned by normal API reads.
    similarityScore: { type: Number, min: 0, max: 1, required: true, select: false },
    differences: { type: duplicateDifferencesSchema, required: true, default: () => ({}) },
    resolution: { type: String, enum: DUPLICATE_RESOLUTIONS, required: true, default: "pending" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

duplicateCandidateSchema.index({ projectId: 1, resolution: 1, createdAt: 1 });
duplicateCandidateSchema.index({ projectId: 1, existingTaskId: 1, resolution: 1 });

export const DuplicateCandidate = model<DuplicateCandidateDocument>(
  "DuplicateCandidate",
  duplicateCandidateSchema
);
