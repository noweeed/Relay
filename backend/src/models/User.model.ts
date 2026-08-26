import { model, Schema, type Types } from "mongoose";

export interface NotificationPreferences {
  upcomingDeadlines: boolean;
  overdueTasks: boolean;
  meetingProcessing: boolean;
  reviewQueue: boolean;
  mentionsAndAssignments: boolean;
  weeklyDigest: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
}

/** Persistent fields stored for an authenticated Relay user. */
export interface UserDocument {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  googleSubject?: string;
  hasPassword: boolean;
  avatarUrl?: string;
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
      index: true,
    },
    // `select: false` prevents an accidental User query from leaking password hashes.
    passwordHash: { type: String, select: false },
    googleSubject: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      select: false,
    },
    hasPassword: { type: Boolean, required: true, default: true },
    avatarUrl: { type: String, trim: true, maxlength: 400_000 },
    notificationPreferences: {
      upcomingDeadlines: { type: Boolean, default: true },
      overdueTasks: { type: Boolean, default: true },
      meetingProcessing: { type: Boolean, default: false },
      reviewQueue: { type: Boolean, default: true },
      mentionsAndAssignments: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: true },
      inAppNotifications: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const User = model<UserDocument>("User", userSchema);
