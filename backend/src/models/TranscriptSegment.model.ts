import { model, Schema, type Types } from "mongoose";

/** One parsed line of a meeting transcript, preserving speaker identity and ordering. */
export interface TranscriptSegmentDocument {
  _id: Types.ObjectId;
  meetingId: Types.ObjectId;
  projectId: Types.ObjectId;
  index: number;
  speaker?: string;
  text: string;
  startMs?: number;
  endMs?: number;
  createdAt: Date;
}

const transcriptSegmentSchema = new Schema<TranscriptSegmentDocument>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    index: { type: Number, required: true, min: 0 },
    speaker: { type: String, trim: true, maxlength: 100 },
    // A plain-text transcript can legally arrive as one line containing the full 500 KB input.
    text: { type: String, required: true, trim: true, maxlength: 500_000 },
    startMs: { type: Number, min: 0 },
    endMs: { type: Number, min: 0 }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Transcript segments are always loaded in order for one meeting.
transcriptSegmentSchema.index({ meetingId: 1, index: 1 });

export const TranscriptSegment = model<TranscriptSegmentDocument>(
  "TranscriptSegment",
  transcriptSegmentSchema
);
