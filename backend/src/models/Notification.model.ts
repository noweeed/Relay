import { model, Schema, type Types } from "mongoose";

export const NOTIFICATION_TYPES = [
  "deadline_upcoming",
  "task_overdue",
  "meeting_ready_for_review",
  "task_assigned",
  "duplicate_detected",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** A durable, user-owned in-app notification. */
export interface NotificationDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  projectId?: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  relatedTaskId?: Types.ObjectId;
  relatedMeetingId?: Types.ObjectId;
  readAt?: Date;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 2_000 },
    relatedTaskId: { type: Schema.Types.ObjectId, ref: "Task", index: true },
    relatedMeetingId: { type: Schema.Types.ObjectId, ref: "Meeting", index: true },
    readAt: { type: Date },
    dedupeKey: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
);

export const Notification = model<NotificationDocument>("Notification", notificationSchema);
