import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { Membership } from "../models/Membership.model";
import type { MeetingDocument } from "../models/Meeting.model";
import { TranscriptSegment } from "../models/TranscriptSegment.model";
import { User } from "../models/User.model";
import { emitMeetingProgress } from "../sockets/meetingEvents";
import { publishAiJob } from "./ai-transport.service";
import { transitionMeetingStatus } from "./meeting-status.service";

export type MeetingAiJobType = "meeting.process" | "meeting.reprocess";

/** Builds the complete, project-scoped context that the Python graph is allowed to see. */
async function buildMeetingPayload(meeting: MeetingDocument): Promise<Record<string, unknown>> {
  const projectId = meeting.projectId.toString();
  const [segments, memberships] = await Promise.all([
    TranscriptSegment.find({ projectId, meetingId: meeting._id }).sort({ index: 1 }),
    Membership.find({ projectId }).select({ userId: 1 }).lean()
  ]);
  const users = await User.find({ _id: { $in: memberships.map((member) => member.userId) } })
    .select({ name: 1 })
    .lean();

  const memberNameCounts = new Map<string, number>();
  for (const user of users) {
    const key = user.name.trim().toLocaleLowerCase();
    memberNameCounts.set(key, (memberNameCounts.get(key) ?? 0) + 1);
  }

  return {
    meetingId: meeting._id.toString(),
    title: meeting.title,
    meetingDate: meeting.createdAt.toISOString().slice(0, 10),
    // Duplicate display names are omitted because the model could not identify either safely.
    projectMembers: users
      .filter((user) => memberNameCounts.get(user.name.trim().toLocaleLowerCase()) === 1)
      .map((user) => ({
        userId: user._id.toString(),
        name: user.name
      })),
    segments: segments.map((segment) => ({
      segmentId: segment._id.toString(),
      order: segment.index,
      ...(segment.speaker ? { speaker: segment.speaker } : {}),
      text: segment.text,
      ...(segment.startMs !== undefined ? { startMs: segment.startMs } : {}),
      ...(segment.endMs !== undefined ? { endMs: segment.endMs } : {})
    }))
  };
}

/** Queues one stored meeting for background AI processing when Redis is configured. */
export async function queueMeetingProcessing(
  meeting: MeetingDocument,
  initiatingUserId: string,
  jobType: MeetingAiJobType
): Promise<MeetingDocument> {
  // Transcript storage remains usable in local development before Redis is configured.
  if (!env.REDIS_URL) {
    logger.info({ meetingId: meeting._id }, "Redis is not configured; meeting remains queued locally");
    return meeting;
  }

  const jobId = randomUUID();
  meeting.activeAiJobId = jobId;
  await transitionMeetingStatus(meeting, "processing");
  emitMeetingProgress({
    meetingId: meeting._id.toString(),
    projectId: meeting.projectId.toString(),
    status: meeting.status
  });

  try {
    await publishAiJob({
      jobId,
      jobType,
      projectId: meeting.projectId.toString(),
      initiatingUserId,
      resourceId: meeting._id.toString(),
      correlationId: meeting._id.toString(),
      payload: await buildMeetingPayload(meeting)
    });
  } catch (error: unknown) {
    // The transcript is already safe in MongoDB; expose a retryable meeting state.
    meeting.activeAiJobId = undefined;
    await transitionMeetingStatus(meeting, "failed", {
      errorMessage: "AI processing could not be queued. Check Redis and retry."
    });
    emitMeetingProgress({
      meetingId: meeting._id.toString(),
      projectId: meeting.projectId.toString(),
      status: meeting.status,
      errorMessage: meeting.errorMessage
    });
    logger.error({ err: error, meetingId: meeting._id }, "Meeting AI job could not be queued");
  }

  return meeting;
}
