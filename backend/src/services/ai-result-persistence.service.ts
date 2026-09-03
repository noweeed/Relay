import mongoose from "mongoose";
import type { AiResultEnvelope } from "../contracts/ai.contract";
import { meetingExtractionResultSchema } from "../contracts/ai.contract";
import { Membership } from "../models/Membership.model";
import { AiJobLedger } from "../models/AiJobLedger.model";
import { Meeting } from "../models/Meeting.model";
import { TaskCandidate } from "../models/TaskCandidate.model";
import { TranscriptSegment } from "../models/TranscriptSegment.model";
import { User } from "../models/User.model";
import { emitMeetingProgress } from "../sockets/meetingEvents";
import { transitionMeetingStatus } from "./meeting-status.service";

export type AiResultPersistenceOutcome =
  | "persisted"
  | "ignored_stale"
  | "ignored_duplicate"
  | "ignored_job_type";

/** Resolves only unambiguous project-member names to permanent user identifiers. */
async function loadMemberIdsByName(
  projectId: string,
  session: mongoose.ClientSession
): Promise<Map<string, mongoose.Types.ObjectId>> {
  const memberships = await Membership.find({ projectId }).select({ userId: 1 }).session(session);
  const users = await User.find({ _id: { $in: memberships.map((item) => item.userId) } })
    .select({ name: 1 })
    .session(session);

  const grouped = new Map<string, mongoose.Types.ObjectId[]>();
  for (const user of users) {
    const key = user.name.trim().toLocaleLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), user._id]);
  }

  return new Map(
    [...grouped.entries()]
      .filter((entry): entry is [string, [mongoose.Types.ObjectId]] => entry[1].length === 1)
      .map(([name, ids]) => [name, ids[0]])
  );
}

/** Persists one validated Python result and advances its meeting to a reviewable state. */
export async function persistAiResult(
  result: AiResultEnvelope
): Promise<AiResultPersistenceOutcome> {
  if (result.jobType !== "meeting.process" && result.jobType !== "meeting.reprocess") {
    return "ignored_job_type";
  }
  if (!result.resourceId || !mongoose.isValidObjectId(result.resourceId)) {
    throw new Error(`AI result ${result.jobId} has no valid meeting resourceId.`);
  }

  const existing = await AiJobLedger.findOne({ jobId: result.jobId }).select({ outcome: 1 }).lean();
  if (existing) return "ignored_duplicate";

  let outcome: AiResultPersistenceOutcome;
  try {
    outcome = await mongoose.connection.transaction(async (session) => {
      const meeting = await Meeting.findOne({
        _id: result.resourceId,
        projectId: result.projectId
      })
        .select("+activeAiJobId")
        .session(session);
      if (!meeting) throw new Error(`AI result ${result.jobId} references an unknown meeting.`);

      // A delayed result from an older reprocessing attempt must never replace newer candidates.
      if (meeting.activeAiJobId !== result.jobId) {
        await AiJobLedger.create(
          [
            {
              jobId: result.jobId,
              projectId: meeting.projectId,
              resourceId: meeting._id,
              outcome: "ignored_stale"
            }
          ],
          { session }
        );
        return "ignored_stale";
      }

    if (result.status === "failed") {
      meeting.activeAiJobId = undefined;
      await transitionMeetingStatus(meeting, "failed", {
        errorMessage: result.error.message.slice(0, 2_000),
        session
      });
      await AiJobLedger.create(
        [
          {
            jobId: result.jobId,
            projectId: meeting.projectId,
            resourceId: meeting._id,
            outcome: "persisted"
          }
        ],
        { session }
      );
      return "persisted";
    }

    const extraction = meetingExtractionResultSchema.parse(result.payload);
    if (extraction.meetingId !== meeting._id.toString()) {
      throw new Error(`AI result ${result.jobId} contains a mismatched meetingId.`);
    }

    const segments = await TranscriptSegment.find({
      projectId: result.projectId,
      meetingId: meeting._id
    })
      .sort({ index: 1 })
      .session(session);
    const segmentsByOrder = new Map(segments.map((segment) => [segment.index, segment]));
    const memberIdsByName = await loadMemberIdsByName(result.projectId, session);

    const candidateDocuments = extraction.tasks.map((task, sourceTaskIndex) => {
      const segment = segmentsByOrder.get(task.segmentOrder);
      if (!segment) {
        throw new Error(`AI result ${result.jobId} references segment order ${task.segmentOrder}.`);
      }
      if (!segment.text.includes(task.sourceQuote)) {
        throw new Error(`AI result ${result.jobId} contains a non-verbatim source quote.`);
      }

      const assigneeId = task.assigneeName
        ? memberIdsByName.get(task.assigneeName.trim().toLocaleLowerCase())
        : undefined;
      return {
        projectId: meeting.projectId,
        meetingId: meeting._id,
        segmentId: segment._id,
        title: task.title,
        ...(task.description ? { description: task.description } : {}),
        ...(assigneeId ? { suggestedAssigneeId: assigneeId } : {}),
        ...(task.dueDate
          ? { suggestedDueDate: new Date(`${task.dueDate}T00:00:00.000Z`) }
          : {}),
        suggestedPriority: task.priority,
        sourceQuote: task.sourceQuote,
        ...(task.confidence !== null && task.confidence !== undefined
          ? { confidence: task.confidence }
          : {}),
        status: "pending" as const,
        sourceJobId: result.jobId,
        sourceTaskIndex
      };
    });

    // Reprocessing replaces only unreviewed suggestions; approved/rejected history is preserved.
    await TaskCandidate.deleteMany(
      { meetingId: meeting._id, status: { $in: ["pending", "duplicate_pending"] } },
      { session }
    );
    if (candidateDocuments.length > 0) {
      await TaskCandidate.insertMany(candidateDocuments, { session });
    }

    meeting.activeAiJobId = undefined;
    await transitionMeetingStatus(meeting, "ready_for_review", { session });
      await AiJobLedger.create(
        [
          {
            jobId: result.jobId,
            projectId: meeting.projectId,
            resourceId: meeting._id,
            outcome: "persisted"
          }
        ],
        { session }
      );
      return "persisted";
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11_000
    ) {
      return "ignored_duplicate";
    }
    throw error;
  }

  if (outcome === "persisted") {
    emitMeetingProgress({
      meetingId: result.resourceId,
      projectId: result.projectId,
      status: result.status === "failed" ? "failed" : "ready_for_review",
      ...(result.status === "failed" ? { errorMessage: result.error.message } : {})
    });
  }
  return outcome;
}
