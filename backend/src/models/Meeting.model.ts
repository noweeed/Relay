import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export const MEETING_TYPES = ["transcript", "audio"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_STATUSES = [
  "created",
  "processing",
  "ready_for_review",
  "completed",
  "failed"
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** A recorded or pasted meeting whose transcript feeds Relay's task-extraction pipeline. */
export interface MeetingFields {
  projectId: Types.ObjectId;
  title: string;
  type: MeetingType;
  status: MeetingStatus;
  rawInput?: string;
  audioUrl?: string;
  audioStorageKey?: string;
  audioOriginalName?: string;
  audioMimeType?: string;
  audioSizeBytes?: number;
  segmentCount: number;
  errorMessage?: string;
  activeAiJobId?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type MeetingDocument = HydratedDocument<MeetingFields>;

const meetingSchema = new Schema<MeetingFields>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    type: { type: String, enum: MEETING_TYPES, required: true, default: "transcript" },
    status: { type: String, enum: MEETING_STATUSES, required: true, default: "created" },
    rawInput: {
      type: String,
      required: function requireTranscriptInput(this: MeetingFields) {
        return this.type === "transcript";
      },
      maxlength: 500_000
    },
    audioUrl: { type: String, trim: true },
    audioStorageKey: { type: String, trim: true, select: false },
    audioOriginalName: { type: String, trim: true, maxlength: 255 },
    audioMimeType: { type: String, trim: true, maxlength: 100 },
    audioSizeBytes: { type: Number, min: 1 },
    segmentCount: { type: Number, required: true, default: 0, min: 0 },
    errorMessage: { type: String, trim: true, maxlength: 2_000 },
    // Identifies the only AI result currently allowed to update this meeting.
    activeAiJobId: { type: String, trim: true, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true, versionKey: false }
);

// Project-scoped meeting lists are always loaded newest-first.
meetingSchema.index({ projectId: 1, createdAt: -1 });

export const Meeting = model<MeetingFields>("Meeting", meetingSchema);
