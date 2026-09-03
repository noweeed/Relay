import { z } from "zod";
import { MEETING_STATUSES } from "../models/Meeting.model";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Enter a valid resource ID.");

export const meetingParamsSchema = z.object({
  projectId: objectId,
  meetingId: objectId
});

export const createMeetingSchema = z.object({
  title: z.string().trim().min(2).max(200),
  transcript: z.string().trim().min(1, "Transcript text is required.").max(500_000)
});

export const createAudioMeetingSchema = z.object({
  title: z.string().trim().min(2).max(200)
});

export const listMeetingsQuerySchema = z.object({
  status: z.enum(MEETING_STATUSES).optional()
});

export const updateMeetingStatusSchema = z.object({
  status: z.enum(MEETING_STATUSES)
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type CreateAudioMeetingInput = z.infer<typeof createAudioMeetingSchema>;
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
export type UpdateMeetingStatusInput = z.infer<typeof updateMeetingStatusSchema>;
