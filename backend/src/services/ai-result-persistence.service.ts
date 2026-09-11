import mongoose from "mongoose";
import type { AiResultEnvelope } from "../contracts/ai.contract";
import {
  commandInterpretResultSchema,
  contentEmbeddingResultSchema,
  meetingExtractionResultSchema,
} from "../contracts/ai.contract";
import { env } from "../config/env";
import { Membership } from "../models/Membership.model";
import { AiJobLedger } from "../models/AiJobLedger.model";
import { CommandLog } from "../models/CommandLog.model";
import { DuplicateCandidate, type DuplicateDifferences } from "../models/DuplicateCandidate.model";
import { Meeting } from "../models/Meeting.model";
import { Project } from "../models/Project.model";
import { TaskCandidate } from "../models/TaskCandidate.model";
import { Task, type TaskDocument } from "../models/Task.model";
import { TranscriptSegment } from "../models/TranscriptSegment.model";
import { User } from "../models/User.model";
import { emitMeetingProgress } from "../sockets/meetingEvents";
import { transitionMeetingStatus } from "./meeting-status.service";
import { hashEmbeddingContent } from "./embedding-refresh.service";

export type AiResultPersistenceOutcome =
  | "persisted"
  | "ignored_stale"
  | "ignored_duplicate"
  | "ignored_job_type";

async function persistEmbeddingResult(
  result: AiResultEnvelope,
): Promise<AiResultPersistenceOutcome> {
  if (!result.resourceId || !mongoose.isValidObjectId(result.resourceId)) {
    throw new Error(`AI result ${result.jobId} has no valid embedding resourceId.`);
  }
  if (await AiJobLedger.exists({ jobId: result.jobId })) return "ignored_duplicate";

  return mongoose.connection.transaction(async (session) => {
    if (await AiJobLedger.exists({ jobId: result.jobId }).session(session)) {
      return "ignored_duplicate";
    }
    if (result.status === "failed") {
      await AiJobLedger.create(
        [{ jobId: result.jobId, projectId: result.projectId, resourceId: result.resourceId, outcome: "persisted" }],
        { session },
      );
      return "persisted";
    }

    const payload = contentEmbeddingResultSchema.parse(result.payload);
    if (payload.resourceId !== result.resourceId) {
      throw new Error(`AI result ${result.jobId} contains a mismatched embedding resourceId.`);
    }
    const resource = payload.resourceKind === "task"
      ? await Task.findOne({ _id: payload.resourceId, projectId: result.projectId }).session(session)
      : await TaskCandidate.findOne({ _id: payload.resourceId, projectId: result.projectId }).session(session);
    if (!resource) throw new Error(`AI result ${result.jobId} references missing content.`);

    const currentHash = hashEmbeddingContent(resource.title, resource.description);
    const outcome = currentHash === payload.contentHash ? "persisted" : "ignored_stale";
    if (outcome === "persisted") {
      resource.embedding = payload.embedding;
      await resource.save({ session });
    }
    await AiJobLedger.create(
      [{ jobId: result.jobId, projectId: result.projectId, resourceId: resource._id, outcome }],
      { session },
    );
    return outcome;
  });
}

/** Applies a command interpretation while keeping queries and mutations inside Node. */
async function persistCommandResult(
  result: AiResultEnvelope,
): Promise<AiResultPersistenceOutcome> {
  if (!result.resourceId || !mongoose.isValidObjectId(result.resourceId)) {
    throw new Error(`AI result ${result.jobId} has no valid command resourceId.`);
  }
  if (await AiJobLedger.exists({ jobId: result.jobId })) return "ignored_duplicate";

  try {
    return await mongoose.connection.transaction(async (session) => {
      const command = await CommandLog.findOne({
        _id: result.resourceId,
        projectId: result.projectId,
      }).session(session);
      if (!command) throw new Error(`AI result ${result.jobId} references an unknown command.`);
      if (command.activeAiJobId !== result.jobId || command.status !== "processing") {
        await AiJobLedger.create(
          [{ jobId: result.jobId, projectId: command.projectId, resourceId: command._id, outcome: "ignored_stale" }],
          { session },
        );
        return "ignored_stale";
      }

      if (result.status === "failed") {
        command.status = "failed";
        command.errorMessage = result.error.message;
      } else {
        const interpretation = commandInterpretResultSchema.parse(result.payload);
        if (interpretation.commandId !== command._id.toString()) {
          throw new Error(`AI result ${result.jobId} contains a mismatched commandId.`);
        }

        command.intent = interpretation.intent;
        command.preview = interpretation.preview;
        command.candidateMatches = interpretation.candidateMatches;
        if (interpretation.candidateMatches.length > 0) {
          const count = await Task.countDocuments({
            _id: { $in: interpretation.candidateMatches.map((candidate) => candidate.id) },
            projectId: command.projectId,
          }).session(session);
          if (count !== interpretation.candidateMatches.length) {
            throw new Error(`AI result ${result.jobId} contains invalid command candidates.`);
          }
        }

        if (interpretation.status === "ambiguous") {
          command.status = "ambiguous";
        } else if (interpretation.status === "unsupported") {
          command.status = "completed";
          command.result = { message: interpretation.preview };
          command.executedAt = new Date();
        } else if (interpretation.intent === "list_overdue_tasks") {
          const project = await Project.findById(command.projectId, { kanbanColumns: 1 })
            .session(session)
            .lean();
          if (!project) throw new Error(`AI result ${result.jobId} references an unknown project.`);
          const doneColumnIds = project.kanbanColumns
            .filter((column) => column.category === "done")
            .map((column) => column.id);
          const overdue = await Task.find({
            projectId: command.projectId,
            dueDate: { $lt: new Date() },
            columnId: { $nin: doneColumnIds },
          })
            .select({ title: 1, dueDate: 1, columnId: 1 })
            .sort({ dueDate: 1 })
            .session(session)
            .lean();
          command.status = "completed";
          command.result = {
            count: overdue.length,
            tasks: overdue.map((task) => ({
              id: task._id.toString(),
              title: task.title,
              dueDate: task.dueDate?.toISOString(),
              columnId: task.columnId,
            })),
          };
          command.executedAt = new Date();
        } else {
          if (!interpretation.taskId) {
            throw new Error(`AI result ${result.jobId} contains no command task target.`);
          }
          const task = await Task.exists({ _id: interpretation.taskId, projectId: command.projectId })
            .session(session);
          if (!task) throw new Error(`AI result ${result.jobId} contains an invalid task target.`);
          if (interpretation.intent === "update_task_status") {
            const project = await Project.findById(command.projectId, { kanbanColumns: 1 })
              .session(session)
              .lean();
            if (!project?.kanbanColumns.some((column) => column.id === interpretation.targetColumnId)) {
              throw new Error(`AI result ${result.jobId} contains an invalid column target.`);
            }
            if (interpretation.targetAssigneeId) {
              const membership = await Membership.exists({
                projectId: command.projectId,
                userId: interpretation.targetAssigneeId,
              }).session(session);
              if (!membership) {
                throw new Error(`AI result ${result.jobId} contains an invalid assignee target.`);
              }
            }
          } else if (interpretation.intent === "assign_task") {
            const membership = await Membership.exists({
              projectId: command.projectId,
              userId: interpretation.targetAssigneeId,
            }).session(session);
            if (!membership) throw new Error(`AI result ${result.jobId} contains an invalid assignee target.`);
          }
          command.status = "awaiting_confirmation";
          command.parameters = {
            taskId: interpretation.taskId,
            ...(interpretation.targetColumnId
              ? { targetColumnId: interpretation.targetColumnId }
              : {}),
            ...(interpretation.targetAssigneeId
              ? { targetAssigneeId: interpretation.targetAssigneeId }
              : {}),
          };
        }
      }

      command.activeAiJobId = undefined;
      await command.save({ session });
      await AiJobLedger.create(
        [{ jobId: result.jobId, projectId: command.projectId, resourceId: command._id, outcome: "persisted" }],
        { session },
      );
      return "persisted";
    });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000) {
      return "ignored_duplicate";
    }
    throw error;
  }
}

function duplicateDifferences(
  existing: TaskDocument,
  candidate: {
    title: string;
    suggestedAssigneeId?: mongoose.Types.ObjectId;
    suggestedDueDate?: Date;
    suggestedPriority: string;
  }
): DuplicateDifferences {
  const differences: DuplicateDifferences = {};
  if (existing.title !== candidate.title) {
    differences.title = { existing: existing.title, candidate: candidate.title };
  }
  const existingDue = existing.dueDate?.toISOString() ?? null;
  const candidateDue = candidate.suggestedDueDate?.toISOString() ?? null;
  if (existingDue !== candidateDue) {
    differences.dueDate = { existing: existingDue, candidate: candidateDue };
  }
  const existingAssignee = existing.assigneeIds?.[0]?.toString() ?? existing.assigneeId?.toString() ?? null;
  const candidateAssignee = candidate.suggestedAssigneeId?.toString() ?? null;
  if (existingAssignee !== candidateAssignee) {
    differences.assigneeId = { existing: existingAssignee, candidate: candidateAssignee };
  }
  if (existing.priority !== candidate.suggestedPriority) {
    differences.priority = {
      existing: existing.priority,
      candidate: candidate.suggestedPriority
    };
  }
  return differences;
}

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
  if (result.jobType === "content.embed") return persistEmbeddingResult(result);
  if (result.jobType === "command.interpret") return persistCommandResult(result);
  if (
    result.jobType !== "meeting.process" &&
    result.jobType !== "meeting.reprocess" &&
    result.jobType !== "meeting.transcribe"
  ) {
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

    if (result.jobType === "meeting.transcribe") {
      if (!extraction.transcript || extraction.transcript.length === 0) {
        throw new Error(`AI result ${result.jobId} contains no audio transcript segments.`);
      }
      const orders = extraction.transcript.map((segment) => segment.order);
      if (new Set(orders).size !== orders.length) {
        throw new Error(`AI result ${result.jobId} contains duplicate transcript orders.`);
      }
      for (const segment of extraction.transcript) {
        if (segment.endMs < segment.startMs) {
          throw new Error(`AI result ${result.jobId} contains an invalid transcript timestamp.`);
        }
        await TranscriptSegment.updateOne(
          { projectId: meeting.projectId, meetingId: meeting._id, index: segment.order },
          {
            $set: {
              text: segment.text,
              startMs: segment.startMs,
              endMs: segment.endMs,
              ...(segment.speaker ? { speaker: segment.speaker } : {})
            },
            ...(!segment.speaker ? { $unset: { speaker: 1 } } : {})
          },
          { upsert: true, session }
        );
      }
      await TranscriptSegment.deleteMany(
        { meetingId: meeting._id, index: { $nin: orders } },
        { session }
      );
      meeting.segmentCount = extraction.transcript.length;
    }

    const segments = await TranscriptSegment.find({
      projectId: result.projectId,
      meetingId: meeting._id
    })
      .sort({ index: 1 })
      .session(session);
    const segmentsByOrder = new Map(segments.map((segment) => [segment.index, segment]));
    const memberIdsByName = await loadMemberIdsByName(result.projectId, session);

    const preparedCandidates = extraction.tasks.map((task, sourceTaskIndex) => {
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
        duplicate: task.duplicate,
        document: {
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
        ...(task.embedding ? { embedding: task.embedding } : {}),
        status: "pending" as "pending" | "duplicate_pending",
        sourceJobId: result.jobId,
        sourceTaskIndex
        }
      };
    });

    const proposedTaskIds = preparedCandidates.flatMap(({ duplicate }) =>
      duplicate && duplicate.verification !== "unrelated" && duplicate.verification !== "related_but_separate"
        ? [duplicate.existingTaskId]
        : []
    );
    const project =
      proposedTaskIds.length > 0
        ? await Project.findById(meeting.projectId, { kanbanColumns: 1 }).session(session).lean()
        : null;
    if (proposedTaskIds.length > 0 && !project) {
      throw new Error(`AI result ${result.jobId} references an unknown project.`);
    }
    const openColumnIds = (project?.kanbanColumns ?? [])
      .filter((column) => column.category === "todo" || column.category === "in_progress")
      .map((column) => column.id);
    const possibleMatches = await Task.find({
      _id: { $in: proposedTaskIds },
      projectId: meeting.projectId,
      columnId: { $in: openColumnIds }
    }).session(session);
    const matchById = new Map(possibleMatches.map((task) => [task._id.toString(), task]));

    for (const prepared of preparedCandidates) {
      const duplicate = prepared.duplicate;
      if (!duplicate || duplicate.verification === "unrelated" || duplicate.verification === "related_but_separate") {
        continue;
      }
      if (duplicate.similarityScore < env.DUPLICATE_MEDIUM_THRESHOLD) {
        throw new Error(`AI result ${result.jobId} contains a duplicate below the configured threshold.`);
      }
      const expectedLabel =
        duplicate.similarityScore >= env.DUPLICATE_HIGH_THRESHOLD ? "high" : "medium";
      if (duplicate.similarityLabel !== expectedLabel) {
        throw new Error(`AI result ${result.jobId} contains an inconsistent similarity label.`);
      }
      if (!matchById.has(duplicate.existingTaskId)) {
        throw new Error(
          `AI result ${result.jobId} references a closed, missing, or cross-project duplicate task.`
        );
      }
      prepared.document.status = "duplicate_pending";
    }

    // Reprocessing replaces only unreviewed suggestions; approved/rejected history is preserved.
    const oldCandidates = await TaskCandidate.find({
      meetingId: meeting._id,
      status: { $in: ["pending", "duplicate_pending"] }
    })
      .select({ _id: 1 })
      .session(session);
    if (oldCandidates.length > 0) {
      await DuplicateCandidate.deleteMany(
        { taskCandidateId: { $in: oldCandidates.map((candidate) => candidate._id) } },
        { session }
      );
    }
    await TaskCandidate.deleteMany(
      { meetingId: meeting._id, status: { $in: ["pending", "duplicate_pending"] } },
      { session }
    );
    if (preparedCandidates.length > 0) {
      const inserted = await TaskCandidate.insertMany(
        preparedCandidates.map((candidate) => candidate.document),
        { session }
      );
      const duplicateDocuments = inserted.flatMap((candidate, index) => {
        const proposal = preparedCandidates[index]?.duplicate;
        if (
          !proposal ||
          proposal.verification === "unrelated" ||
          proposal.verification === "related_but_separate"
        ) {
          return [];
        }
        const existing = matchById.get(proposal.existingTaskId);
        if (!existing) return [];
        return [{
          projectId: meeting.projectId,
          taskCandidateId: candidate._id,
          existingTaskId: existing._id,
          similarityLabel: proposal.similarityLabel,
          similarityScore: proposal.similarityScore,
          differences: duplicateDifferences(existing, candidate),
          resolution: "pending" as const
        }];
      });
      if (duplicateDocuments.length > 0) {
        await DuplicateCandidate.insertMany(duplicateDocuments, { session });
      }
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
