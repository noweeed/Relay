import type { Request, Response } from "express";
import * as meetingService from "../services/meeting.service";
import { ApiError } from "../utils/ApiError";
import type {
  CreateAudioMeetingInput,
  CreateMeetingInput,
  ListMeetingsQuery,
  UpdateMeetingStatusInput
} from "../validators/meeting.validator";

/** Reads the trusted identities installed by authentication and membership middleware. */
function getMeetingContext(request: Request): { userId: string; projectId: string } {
  if (!request.user || !request.projectMembership) {
    throw new ApiError(500, "INTERNAL_ERROR", "Meeting authorization context is missing.");
  }
  return {
    userId: request.user.id,
    projectId: request.projectMembership.projectId
  };
}

/** Reads the validated meeting identifier from route parameters. */
function getMeetingId(request: Request): string {
  const meetingId = request.params.meetingId;
  if (typeof meetingId !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid meeting ID is required.");
  }
  return meetingId;
}

/** Creates a meeting from pasted transcript text. */
export async function createMeeting(request: Request, response: Response): Promise<void> {
  const context = getMeetingContext(request);
  const meeting = await meetingService.createMeeting(
    context.projectId,
    context.userId,
    request.body as CreateMeetingInput
  );
  response.status(201).json({ success: true, data: meeting });
}

/** Stores one multipart audio meeting and returns before transcription begins. */
export async function createAudioMeeting(request: Request, response: Response): Promise<void> {
  if (!request.file) {
    throw new ApiError(400, "VALIDATION_ERROR", "An audio file is required.");
  }
  const context = getMeetingContext(request);
  const meeting = await meetingService.createAudioMeeting(
    context.projectId,
    context.userId,
    request.body as CreateAudioMeetingInput,
    request.file
  );
  response.status(201).json({ success: true, data: meeting });
}

/** Streams project-private meeting audio after membership authorization. */
export async function getMeetingAudio(request: Request, response: Response): Promise<void> {
  const context = getMeetingContext(request);
  const audio = await meetingService.getMeetingAudio(context.projectId, getMeetingId(request));
  response.setHeader("Content-Type", audio.mimeType);
  response.setHeader("Content-Length", audio.body.length);
  response.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(audio.originalName)}`);
  response.send(audio.body);
}

/** Lists meetings for the authorized project. */
export async function listMeetings(request: Request, response: Response): Promise<void> {
  const context = getMeetingContext(request);
  const meetings = await meetingService.listMeetings(
    context.projectId,
    request.query as unknown as ListMeetingsQuery
  );
  response.json({ success: true, data: meetings });
}

/** Returns a single meeting from the authorized project. */
export async function getMeeting(request: Request, response: Response): Promise<void> {
  const context = getMeetingContext(request);
  const meeting = await meetingService.getMeeting(context.projectId, getMeetingId(request));
  response.json({ success: true, data: meeting });
}

/** Returns the ordered transcript segments for a meeting. */
export async function getMeetingTranscript(request: Request, response: Response): Promise<void> {
  const context = getMeetingContext(request);
  const segments = await meetingService.getMeetingTranscript(context.projectId, getMeetingId(request));
  response.json({ success: true, data: segments });
}

/** Returns tasks sourced from a specific meeting. */
export async function getMeetingTasks(request: Request, response: Response): Promise<void> {
  const context = getMeetingContext(request);
  const tasks = await meetingService.getMeetingTasks(context.projectId, getMeetingId(request));
  response.json({ success: true, data: tasks });
}

/** Advances the meeting status along the defined state machine. */
export async function updateMeetingStatus(request: Request, response: Response): Promise<void> {
  const context = getMeetingContext(request);
  const meeting = await meetingService.updateMeetingStatus(
    context.projectId,
    getMeetingId(request),
    request.body as UpdateMeetingStatusInput
  );
  response.json({ success: true, data: meeting });
}

/** Resets a failed meeting to allow reprocessing. */
export async function requestReprocess(request: Request, response: Response): Promise<void> {
  const context = getMeetingContext(request);
  const meeting = await meetingService.requestReprocess(
    context.projectId,
    getMeetingId(request),
    context.userId
  );
  response.json({ success: true, data: meeting });
}
