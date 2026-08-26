import { model, Schema, type Types } from "mongoose";

/** Server-side state that makes a signed refresh token revocable and rotatable. */
export interface RefreshSessionDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  rotatedAt?: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshSessionSchema = new Schema<RefreshSessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Only the SHA-256 digest is stored; a database read cannot reveal a usable token.
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    rotatedAt: Date,
    userAgent: { type: String, maxlength: 500 },
    ipAddress: { type: String, maxlength: 100 }
  },
  { timestamps: true, versionKey: false }
);

// MongoDB removes expired sessions automatically; application checks still enforce expiry immediately.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession = model<RefreshSessionDocument>("RefreshSession", refreshSessionSchema);
