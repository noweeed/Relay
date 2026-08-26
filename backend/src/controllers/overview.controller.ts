import type { Request, Response } from "express";
import * as overviewService from "../services/overview.service";
import { ApiError } from "../utils/ApiError";

/** Returns a project dashboard summary to any authorized member. */
export async function getProjectOverview(request: Request, response: Response): Promise<void> {
  if (!request.projectMembership) {
    throw new ApiError(500, "INTERNAL_ERROR", "Project authorization context is missing.");
  }
  const overview = await overviewService.getProjectOverview(
    request.projectMembership.projectId
  );
  response.json({ success: true, data: overview });
}
