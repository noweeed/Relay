import { z } from "zod";
import { TASK_CANDIDATE_STATUSES } from "../models/TaskCandidate.model";
import { TASK_PRIORITIES } from "../models/Task.model";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Enter a valid resource ID.");

export const candidateParamsSchema = z.object({
  projectId: objectId,
  meetingId: objectId,
  candidateId: objectId
});

export const candidateCollectionParamsSchema = z.object({
  projectId: objectId,
  meetingId: objectId
});

export const listCandidatesQuerySchema = z.object({
  status: z.enum(TASK_CANDIDATE_STATUSES).optional()
});

export const updateCandidateSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5_000).nullable().optional(),
    suggestedAssigneeId: objectId.nullable().optional(),
    suggestedDueDate: z.coerce.date().nullable().optional(),
    suggestedPriority: z.enum(TASK_PRIORITIES).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const bulkCandidateActionSchema = z.object({
  candidateIds: z.array(objectId).min(1).max(100).refine(
    (candidateIds) => new Set(candidateIds).size === candidateIds.length,
    "Candidate IDs must be unique."
  )
});

export type ListCandidatesQuery = z.infer<typeof listCandidatesQuerySchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
export type BulkCandidateActionInput = z.infer<typeof bulkCandidateActionSchema>;
