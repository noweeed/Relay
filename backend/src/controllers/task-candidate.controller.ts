import type { Request, Response } from "express";
import * as candidateService from "../services/task-candidate.service";
import { ApiError } from "../utils/ApiError";
import type {
  BulkCandidateActionInput,
  ListCandidatesQuery,
  UpdateCandidateInput
} from "../validators/task-candidate.validator";

function getContext(request: Request): { projectId: string; userId: string } {
  if (!request.user || !request.projectMembership) {
    throw new ApiError(500, "INTERNAL_ERROR", "Candidate authorization context is missing.");
  }
  return { projectId: request.projectMembership.projectId, userId: request.user.id };
}

function getParam(request: Request, name: "meetingId" | "candidateId"): string {
  const value = request.params[name];
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", `A valid ${name} is required.`);
  }
  return value;
}

export async function listCandidates(request: Request, response: Response): Promise<void> {
  const { projectId } = getContext(request);
  const candidates = await candidateService.listCandidates(
    projectId,
    getParam(request, "meetingId"),
    request.query as unknown as ListCandidatesQuery
  );
  response.json({ success: true, data: candidates });
}

export async function updateCandidate(request: Request, response: Response): Promise<void> {
  const { projectId } = getContext(request);
  const candidate = await candidateService.updateCandidate(
    projectId,
    getParam(request, "meetingId"),
    getParam(request, "candidateId"),
    request.body as UpdateCandidateInput
  );
  response.json({ success: true, data: candidate });
}

export async function approveCandidate(request: Request, response: Response): Promise<void> {
  const { projectId, userId } = getContext(request);
  const result = await candidateService.approveCandidate(
    projectId,
    getParam(request, "meetingId"),
    getParam(request, "candidateId"),
    userId
  );
  response.json({ success: true, data: result });
}

export async function rejectCandidate(request: Request, response: Response): Promise<void> {
  const { projectId } = getContext(request);
  const candidate = await candidateService.rejectCandidate(
    projectId,
    getParam(request, "meetingId"),
    getParam(request, "candidateId")
  );
  response.json({ success: true, data: candidate });
}

export async function bulkApproveCandidates(request: Request, response: Response): Promise<void> {
  const { projectId, userId } = getContext(request);
  const result = await candidateService.bulkApproveCandidates(
    projectId,
    getParam(request, "meetingId"),
    (request.body as BulkCandidateActionInput).candidateIds,
    userId
  );
  response.json({ success: true, data: result });
}

export async function bulkRejectCandidates(request: Request, response: Response): Promise<void> {
  const { projectId } = getContext(request);
  const candidates = await candidateService.bulkRejectCandidates(
    projectId,
    getParam(request, "meetingId"),
    (request.body as BulkCandidateActionInput).candidateIds
  );
  response.json({ success: true, data: candidates });
}
