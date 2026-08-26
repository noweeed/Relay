import { model, Schema, type Types } from "mongoose";

/** Persistent fields stored for an authenticated Relay user. */
export interface UserDocument {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
      index: true
    },
    // `select: false` prevents an accidental User query from leaking password hashes.
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, trim: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const User = model<UserDocument>("User", userSchema);
