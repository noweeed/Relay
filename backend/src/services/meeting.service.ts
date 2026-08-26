import mongoose from "mongoose";
import {
  Meeting,
  type MeetingDocument,
  type MeetingStatus
} from "../models/Meeting.model";
import { Task } from "../models/Task.model";
import { TranscriptSegment, type TranscriptSegmentDocument } from "../models/TranscriptSegment.model";
import { ApiError } from "../utils/ApiError";
import { parseTranscript } from "../utils/transcript-parser";
import type { TaskResponse } from "./task.service";
import type {
  CreateMeetingInput,
  ListMeetingsQuery,
  UpdateMeetingStatusInput
} from "../validators/meeting.validator";

export interface MeetingResponse {
  id: string;
  projectId: string;
  title: string;
  type: string;
  status: string;
  segmentCount: number;
  errorMessage?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptSegmentResponse {
  id: string;
  meetingId: string;
  index: number;
  speaker?: string;
  text: string;
  startMs?: number;
  endMs?: number;
  createdAt: Date;
}

/** Converts a Mongoose meeting into the stable API response. */
function serializeMeeting(meeting: MeetingDocument): MeetingResponse {
  return {
    id: meeting._id.toString(),
    projectId: meeting.projectId.toString(),
    title: meeting.title,
    type: meeting.type,
    status: meeting.status,
    segmentCount: meeting.segmentCount,
    ...(meeting.errorMessage ? { errorMessage: meeting.errorMessage } : {}),
    createdBy: meeting.createdBy.toString(),
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt
  };
}

/** Converts a Mongoose transcript segment into the API shape. */
function serializeSegment(segment: TranscriptSegmentDocument): TranscriptSegmentResponse {
  return {
    id: segment._id.toString(),
    meetingId: segment.meetingId.toString(),
    index: segment.index,
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
    text: segment.text,
    ...(segment.startMs !== undefined ? { startMs: segment.startMs } : {}),
    ...(segment.endMs !== undefined ? { endMs: segment.endMs } : {}),
    createdAt: segment.createdAt
  };
}

/** Parses the pasted transcript and persists the meeting plus its segments atomically. */
export async function createMeeting(
  projectId: string,
  userId: string,
  input: CreateMeetingInput
): Promise<MeetingResponse> {
  const parsed = parseTranscript(input.transcript);
  if (parsed.length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "The transcript could not be parsed into any segments.");
  }

  let createdMeeting: MeetingDocument | undefined;
  await mongoose.connection.transaction(async (session) => {
    const [meeting] = await Meeting.create(
      [
        {
          projectId,
          title: input.title,
          type: "transcript",
          status: "created",
          rawInput: input.transcript,
          segmentCount: parsed.length,
          createdBy: userId
        }
      ],
      { session }
    );
    if (!meeting) throw new ApiError(500, "INTERNAL_ERROR", "Meeting creation failed.");

    const segmentDocs = parsed.map((segment, index) => ({
      meetingId: meeting._id,
      projectId,
      index,
      ...(segment.speaker ? { speaker: segment.speaker } : {}),
      text: segment.text
    }));

    await TranscriptSegment.insertMany(segmentDocs, { session });
    createdMeeting = meeting;
  });

  if (!createdMeeting) throw new ApiError(500, "INTERNAL_ERROR", "Meeting creation failed.");
  return serializeMeeting(createdMeeting);
}

/** Lists project meetings newest-first with an optional status filter. */
export async function listMeetings(
  projectId: string,
  query: ListMeetingsQuery
): Promise<MeetingResponse[]> {
  const filter: Record<string, unknown> = { projectId };
  if (query.status) filter.status = query.status;

  const meetings = await Meeting.find(filter).sort({ createdAt: -1 });
  return meetings.map(serializeMeeting);
}

/** Returns one meeting from the authorized project. */
export async function getMeeting(
  projectId: string,
  meetingId: string
): Promise<MeetingResponse> {
  const meeting = await Meeting.findOne({ _id: meetingId, projectId });
  if (!meeting) throw new ApiError(404, "NOT_FOUND", "Meeting was not found.");
  return serializeMeeting(meeting);
}

/** Returns the ordered transcript segments for a meeting. */
export async function getMeetingTranscript(
  projectId: string,
  meetingId: string
): Promise<TranscriptSegmentResponse[]> {
  const meeting = await Meeting.exists({ _id: meetingId, projectId });
  if (!meeting) throw new ApiError(404, "NOT_FOUND", "Meeting was not found.");

  const segments = await TranscriptSegment.find({ meetingId, projectId }).sort({ index: 1 });
  return segments.map(serializeSegment);
}

/** Returns tasks whose source traces back to a specific meeting. */
export async function getMeetingTasks(
  projectId: string,
  meetingId: string
): Promise<TaskResponse[]> {
  const meeting = await Meeting.exists({ _id: meetingId, projectId });
  if (!meeting) throw new ApiError(404, "NOT_FOUND", "Meeting was not found.");

  const tasks = await Task.find({ projectId, "source.meetingId": meetingId }).sort({ createdAt: -1 });
  return tasks.map((task) => ({
    id: task._id.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    ...(task.assigneeId ? { assigneeId: task.assigneeId.toString() } : {}),
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    priority: task.priority,
    columnId: task.columnId,
    ...(task.source
      ? {
          source: {
            meetingId: task.source.meetingId.toString(),
            ...(task.source.segmentId ? { segmentId: task.source.segmentId.toString() } : {}),
            ...(task.source.quote ? { quote: task.source.quote } : {}),
            ...(task.source.timestampMs !== undefined ? { timestampMs: task.source.timestampMs } : {})
          }
        }
      : {}),
    createdBy: task.createdBy.toString(),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }));
}

/** Valid forward transitions in the meeting status state machine. */
const VALID_TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  created: ["processing"],
  processing: ["ready_for_review", "failed"],
  ready_for_review: ["completed"],
  completed: [],
  failed: ["created"]
};

/** Advances a meeting's status along the defined state machine. */
export async function updateMeetingStatus(
  projectId: string,
  meetingId: string,
  input: UpdateMeetingStatusInput
): Promise<MeetingResponse> {
  const meeting = await Meeting.findOne({ _id: meetingId, projectId });
  if (!meeting) throw new ApiError(404, "NOT_FOUND", "Meeting was not found.");

  const allowed = VALID_TRANSITIONS[meeting.status as MeetingStatus];
  if (!allowed || !allowed.includes(input.status)) {
    throw new ApiError(
      409,
      "CONFLICT",
      `Cannot transition from "${meeting.status}" to "${input.status}".`
    );
  }

  meeting.status = input.status;
  if (input.status !== "failed") meeting.errorMessage = undefined;
  await meeting.save();
  return serializeMeeting(meeting);
}

/** Resets a failed meeting back to created so the AI pipeline can retry. */
export async function requestReprocess(
  projectId: string,
  meetingId: string
): Promise<MeetingResponse> {
  const meeting = await Meeting.findOne({ _id: meetingId, projectId });
  if (!meeting) throw new ApiError(404, "NOT_FOUND", "Meeting was not found.");

  if (meeting.status !== "failed") {
    throw new ApiError(409, "CONFLICT", "Only failed meetings can be reprocessed.");
  }

  meeting.status = "created";
  meeting.errorMessage = undefined;
  await meeting.save();
  return serializeMeeting(meeting);
}
