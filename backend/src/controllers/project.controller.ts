import type { Request, Response } from "express";
import * as projectService from "../services/project.service";
import { ApiError } from "../utils/ApiError";
import type {
  CreateProjectInput,
  InviteProjectMemberInput,
  UpdateProjectInput
} from "../validators/project.validator";

/** Reads identities guaranteed by authentication and membership middleware. */
function getProjectContext(request: Request): {
  userId: string;
  projectId: string;
  role: NonNullable<Request["projectMembership"]>["role"];
} {
  if (!request.user || !request.projectMembership) {
    throw new ApiError(500, "INTERNAL_ERROR", "Project authorization context is missing.");
  }

  return {
    userId: request.user.id,
    projectId: request.projectMembership.projectId,
    role: request.projectMembership.role
  };
}

/** Creates a project and makes the authenticated user its owner. */
export async function createProject(request: Request, response: Response): Promise<void> {
  if (!request.user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  const project = await projectService.createProject(
    request.user.id,
    request.body as CreateProjectInput
  );
  response.status(201).json({ success: true, data: project });
}

/** Lists only projects that contain a membership for the current user. */
export async function listProjects(request: Request, response: Response): Promise<void> {
  if (!request.user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  const projects = await projectService.listProjects(request.user.id);
  response.json({ success: true, data: projects });
}

/** Returns a single authorized project. */
export async function getProject(request: Request, response: Response): Promise<void> {
  const context = getProjectContext(request);
  const project = await projectService.getProject(context.projectId, context.role);
  response.json({ success: true, data: project });
}

/** Updates mutable project fields for an owner or admin. */
export async function updateProject(request: Request, response: Response): Promise<void> {
  const context = getProjectContext(request);
  const project = await projectService.updateProject(
    context.projectId,
    context.role,
    request.body as UpdateProjectInput
  );
  response.json({ success: true, data: project });
}

/** Permanently deletes a project after owner authorization. */
export async function deleteProject(request: Request, response: Response): Promise<void> {
  const context = getProjectContext(request);
  await projectService.deleteProject(context.projectId);
  response.json({ success: true, data: { deleted: true } });
}

/** Lists project members with public user fields and roles. */
export async function listProjectMembers(request: Request, response: Response): Promise<void> {
  const context = getProjectContext(request);
  const members = await projectService.listProjectMembers(context.projectId);
  response.json({ success: true, data: members });
}

/** Adds an existing Relay user to the project by email. */
export async function inviteProjectMember(request: Request, response: Response): Promise<void> {
  const context = getProjectContext(request);
  const member = await projectService.inviteProjectMember(
    context.projectId,
    request.body as InviteProjectMemberInput
  );
  response.status(201).json({ success: true, data: member });
}

/** Removes a member while enforcing the owner/admin hierarchy. */
export async function removeProjectMember(request: Request, response: Response): Promise<void> {
  const context = getProjectContext(request);
  const targetUserId = request.params.userId;
  if (typeof targetUserId !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid user ID is required.");
  }
  await projectService.removeProjectMember(
    context.projectId,
    targetUserId,
    context.userId,
    context.role
  );
  response.json({ success: true, data: { removed: true } });
}
