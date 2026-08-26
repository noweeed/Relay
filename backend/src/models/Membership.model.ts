import { model, Schema, type Types } from "mongoose";

export const PROJECT_ROLES = ["owner", "admin", "member"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** Links one user to one project and records their authorization role. */
export interface MembershipDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  role: ProjectRole;
  teamRole: string;
  createdAt: Date;
}

const membershipSchema = new Schema<MembershipDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: { type: String, enum: PROJECT_ROLES, required: true },
    teamRole: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
      default: "Team member",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// A user may have exactly one role in a project.
membershipSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const Membership = model<MembershipDocument>(
  "Membership",
  membershipSchema,
);
