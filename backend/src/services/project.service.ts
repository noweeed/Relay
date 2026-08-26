import mongoose, { Types } from "mongoose";
import { Membership, type ProjectRole } from "../models/Membership.model";
import { Meeting } from "../models/Meeting.model";
import {
  Project,
  type KanbanColumn,
  type ProjectDocument,
} from "../models/Project.model";
import { Task } from "../models/Task.model";
import { TaskActivity } from "../models/TaskActivity.model";
import { TaskCandidate } from "../models/TaskCandidate.model";
import { TranscriptSegment } from "../models/TranscriptSegment.model";
import { User } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import type {
  CreateProjectInput,
  InviteProjectMemberInput,
  TransferProjectOwnershipInput,
  UpdateProjectMemberInput,
  UpdateProjectInput,
} from "../validators/project.validator";

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  kanbanColumns: KanbanColumn[];
  createdBy: string;
  role: ProjectRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMemberResponse {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: ProjectRole;
  teamRole: string;
  joinedAt: Date;
}

/** Converts a project document plus the caller's role into an API response. */
function serializeProject(
  project: ProjectDocument,
  role: ProjectRole,
): ProjectResponse {
  return {
    id: project._id.toString(),
    name: project.name,
    ...(project.description ? { description: project.description } : {}),
    kanbanColumns: [...project.kanbanColumns]
      .sort((left, right) => left.order - right.order)
      .map((column) => ({
        id: column.id,
        name: column.name,
        color: column.color,
        category: column.category,
        order: column.order,
      })),
    createdBy: project.createdBy.toString(),
    role,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/** Creates the project and its owner membership in one MongoDB transaction. */
export async function createProject(
  userId: string,
  input: CreateProjectInput,
): Promise<ProjectResponse> {
  let createdProject: ProjectDocument | undefined;

  await mongoose.connection.transaction(async (session) => {
    const [project] = await Project.create(
      [{ name: input.name, description: input.description, createdBy: userId }],
      { session },
    );

    if (!project)
      throw new ApiError(500, "INTERNAL_ERROR", "Project creation failed.");

    await Membership.create(
      [
        {
          projectId: project._id,
          userId,
          role: "owner",
          teamRole: "Project owner",
        },
      ],
      { session },
    );
    createdProject = project;
  });

  if (!createdProject)
    throw new ApiError(500, "INTERNAL_ERROR", "Project creation failed.");
  return serializeProject(createdProject, "owner");
}

/** Returns only projects for which the caller has a membership. */
export async function listProjects(userId: string): Promise<ProjectResponse[]> {
  const memberships = await Membership.find({ userId }).lean();
  const projects = await Project.find({
    _id: { $in: memberships.map((membership) => membership.projectId) },
  });
  const roleByProject = new Map(
    memberships.map((membership) => [
      membership.projectId.toString(),
      membership.role,
    ]),
  );

  return projects.map((project) =>
    serializeProject(
      project,
      roleByProject.get(project._id.toString()) ?? "member",
    ),
  );
}

/** Loads one authorized project with the caller's role. */
export async function getProject(
  projectId: string,
  role: ProjectRole,
): Promise<ProjectResponse> {
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project was not found.");
  return serializeProject(project, role);
}

/** Applies owner/admin edits to the project's mutable fields. */
export async function updateProject(
  projectId: string,
  role: ProjectRole,
  input: UpdateProjectInput,
): Promise<ProjectResponse> {
  const project = await Project.findByIdAndUpdate(
    projectId,
    { $set: input },
    { returnDocument: "after" },
  );
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project was not found.");
  return serializeProject(project, role);
}

/** Deletes a project and all current dependent records atomically. */
export async function deleteProject(projectId: string): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    const project = await Project.findByIdAndDelete(projectId, { session });
    if (!project)
      throw new ApiError(404, "NOT_FOUND", "Project was not found.");
    // Transaction operations stay sequential because MongoDB sessions do not support parallel writes.
    await Membership.deleteMany({ projectId }, { session });
    await Task.deleteMany({ projectId }, { session });
    await TaskActivity.deleteMany({ projectId }, { session });
    await TaskCandidate.deleteMany({ projectId }, { session });
    await TranscriptSegment.deleteMany({ projectId }, { session });
    await Meeting.deleteMany({ projectId }, { session });
  });
}

/** Joins memberships with public user fields without exposing password hashes. */
export async function listProjectMembers(
  projectId: string,
): Promise<ProjectMemberResponse[]> {
  const memberships = await Membership.find({ projectId }).lean();
  const users = await User.find({
    _id: { $in: memberships.map((membership) => membership.userId) },
  }).lean();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));

  return memberships.flatMap((membership) => {
    const user = userById.get(membership.userId.toString());
    if (!user) return [];

    return [
      {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
        role: membership.role,
        teamRole: membership.teamRole ?? "Team member",
        joinedAt: membership.createdAt,
      },
    ];
  });
}

/** Adds an existing Relay user by email; outbound email invitations are intentionally deferred. */
export async function inviteProjectMember(
  projectId: string,
  input: InviteProjectMemberInput,
): Promise<ProjectMemberResponse> {
  const user = await User.findOne({ email: input.email });
  if (!user) {
    throw new ApiError(
      404,
      "NOT_FOUND",
      "No Relay user exists with this email address.",
    );
  }

  const existingMembership = await Membership.exists({
    projectId,
    userId: user._id,
  });
  if (existingMembership) {
    throw new ApiError(
      409,
      "CONFLICT",
      "This user is already a project member.",
    );
  }

  const membership = await Membership.create({
    projectId,
    userId: user._id,
    role: input.role,
    teamRole: input.teamRole,
  });
  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    role: membership.role,
    teamRole: membership.teamRole,
    joinedAt: membership.createdAt,
  };
}

/** Updates only the descriptive team role, never the authorization role. */
export async function updateProjectMember(
  projectId: string,
  targetUserId: string,
  input: UpdateProjectMemberInput,
): Promise<ProjectMemberResponse> {
  const membership = await Membership.findOneAndUpdate(
    { projectId, userId: targetUserId },
    { $set: { teamRole: input.teamRole } },
    { returnDocument: "after", runValidators: true },
  );
  if (!membership)
    throw new ApiError(404, "NOT_FOUND", "Project member was not found.");

  const user = await User.findById(targetUserId);
  if (!user)
    throw new ApiError(404, "NOT_FOUND", "Project member was not found.");
  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    role: membership.role,
    teamRole: membership.teamRole,
    joinedAt: membership.createdAt,
  };
}

/** Atomically promotes one existing member to owner and demotes the previous owner to admin. */
export async function transferProjectOwnership(
  projectId: string,
  actorUserId: string,
  input: TransferProjectOwnershipInput,
): Promise<void> {
  if (input.userId === actorUserId) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Choose another project member.",
    );
  }
  await mongoose.connection.transaction(async (session) => {
    const actor = await Membership.findOne({
      projectId,
      userId: actorUserId,
    }).session(session);
    const target = await Membership.findOne({
      projectId,
      userId: input.userId,
    }).session(session);
    if (!actor || actor.role !== "owner") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only the current project owner can transfer ownership.",
      );
    }
    if (!target) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "The new owner must already be a project member.",
      );
    }
    actor.role = "admin";
    target.role = "owner";
    await actor.save({ session });
    await target.save({ session });
  });
}

/** Enforces role hierarchy and prevents removal of the sole project owner. */
export async function removeProjectMember(
  projectId: string,
  targetUserId: string,
  actorUserId: string,
  actorRole: ProjectRole,
): Promise<void> {
  const membership = await Membership.findOne({
    projectId,
    userId: targetUserId,
  });
  if (!membership)
    throw new ApiError(404, "NOT_FOUND", "Project member was not found.");

  if (membership.role === "owner") {
    throw new ApiError(409, "CONFLICT", "The project owner cannot be removed.");
  }

  if (actorRole === "admin" && membership.role !== "member") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Admins can remove members, not other admins.",
    );
  }

  if (targetUserId === actorUserId && actorRole === "admin") {
    throw new ApiError(
      409,
      "CONFLICT",
      "Admins cannot remove their own membership.",
    );
  }

  await Membership.deleteOne({ _id: new Types.ObjectId(membership._id) });
}
