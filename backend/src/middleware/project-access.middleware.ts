import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Membership, type ProjectRole } from "../models/Membership.model";
import { ApiError } from "../utils/ApiError";

/** Loads the current user's project membership instead of trusting a client-supplied project ID. */
export const requireProjectMembership: RequestHandler = async (
  request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!request.user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    }

    const projectId = request.params.projectId;
    if (typeof projectId !== "string") {
      throw new ApiError(400, "VALIDATION_ERROR", "A valid project ID is required.");
    }
    const membership = await Membership.findOne({ projectId, userId: request.user.id }).lean();

    if (!membership) {
      // A generic forbidden response avoids confirming whether a private project exists.
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this project.");
    }

    request.projectMembership = { projectId, role: membership.role };
    next();
  } catch (error: unknown) {
    next(error);
  }
};

/** Restricts a project route to one or more roles after membership has been loaded. */
export function requireProjectRole(...allowedRoles: ProjectRole[]): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const membership = request.projectMembership;

    if (!membership || !allowedRoles.includes(membership.role)) {
      next(new ApiError(403, "FORBIDDEN", "Your project role cannot perform this action."));
      return;
    }

    next();
  };
}
