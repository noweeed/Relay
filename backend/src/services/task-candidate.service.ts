import mongoose, { type ClientSession, type HydratedDocument, type Types } from "mongoose";
import {
  DuplicateCandidate,
  type DuplicateCandidateDocument,
  type DuplicateDifferences,
  type DuplicateResolution,
  type DuplicateSimilarityLabel
} from "../models/DuplicateCandidate.model";
import { Membership } from "../models/Membership.model";
import { Meeting } from "../models/Meeting.model";
import { Project } from "../models/Project.model";
import {
  TaskCandidate,
  type TaskCandidateDocument,
  type TaskCandidateStatus
} from "../models/TaskCandidate.model";
import { Task, type TaskDocument, type TaskPriority } from "../models/Task.model";
import { TaskActivity } from "../models/TaskActivity.model";
import { TranscriptSegment } from "../models/TranscriptSegment.model";
import { emitMeetingProgress } from "../sockets/meetingEvents";
import { emitTaskCreated, emitTaskUpdated } from "../sockets/taskEvents";
import { ApiError } from "../utils/ApiError";
import { queueEmbeddingRefresh } from "./embedding-refresh.service";
import { assertCanWorkOnTask, type TaskResponse } from "./task.service";
import type {
  ListCandidatesQuery,
  ResolveDuplicateInput,
  UpdateCandidateInput
} from "../validators/task-candidate.validator";

export interface TaskCandidateResponse {
  id: string;
  projectId: string;
  meetingId: string;
  segmentId?: string;
  title: string;
  description?: string;
  suggestedAssigneeId?: string;
  suggestedDueDate?: Date;
  suggestedPriority: TaskPriority;
  sourceQuote: string;
  sourceTimestampMs?: number;
  status: TaskCandidateStatus;
  createdTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
  duplicate?: {
    id: string;
    existingTaskId: string;
    similarityLabel: DuplicateSimilarityLabel;
    differences: DuplicateDifferences;
    resolution: DuplicateResolution;
  };
}

export interface CandidateApprovalResponse {
  candidate: TaskCandidateResponse;
  task: TaskResponse;
}

type TimestampMap = Map<string, number | undefined>;
type TaskCandidateRecord = HydratedDocument<TaskCandidateDocument>;
type DuplicateCandidateRecord = HydratedDocument<DuplicateCandidateDocument>;

function serializeDuplicate(duplicate: DuplicateCandidateDocument) {
  return {
    id: duplicate._id.toString(),
    existingTaskId: duplicate.existingTaskId.toString(),
    similarityLabel: duplicate.similarityLabel,
    differences: duplicate.differences,
    resolution: duplicate.resolution
  };
}

function serializeCandidate(
  candidate: TaskCandidateDocument,
  sourceTimestampMs?: number,
  duplicate?: DuplicateCandidateDocument
): TaskCandidateResponse {
  return {
    id: candidate._id.toString(),
    projectId: candidate.projectId.toString(),
    meetingId: candidate.meetingId.toString(),
    ...(candidate.segmentId ? { segmentId: candidate.segmentId.toString() } : {}),
    title: candidate.title,
    ...(candidate.description ? { description: candidate.description } : {}),
    ...(candidate.suggestedAssigneeId
      ? { suggestedAssigneeId: candidate.suggestedAssigneeId.toString() }
      : {}),
    ...(candidate.suggestedDueDate ? { suggestedDueDate: candidate.suggestedDueDate } : {}),
    suggestedPriority: candidate.suggestedPriority,
    sourceQuote: candidate.sourceQuote,
    ...(sourceTimestampMs !== undefined ? { sourceTimestampMs } : {}),
    status: candidate.status,
    ...(candidate.createdTaskId ? { createdTaskId: candidate.createdTaskId.toString() } : {}),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    ...(duplicate ? { duplicate: serializeDuplicate(duplicate) } : {})
  };
}

function serializeTask(task: TaskDocument): TaskResponse {
  const assigneeIds = (task.assigneeIds ?? []).map((id) => id.toString());
  if (assigneeIds.length === 0 && task.assigneeId) assigneeIds.push(task.assigneeId.toString());
  return {
    id: task._id.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    assigneeIds,
    ...(assigneeIds[0] ? { assigneeId: assigneeIds[0] } : {}),
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    priority: task.priority,
    columnId: task.columnId,
    ...(task.source
      ? {
          source: {
            meetingId: task.source.meetingId.toString(),
            ...(task.source.segmentId ? { segmentId: task.source.segmentId.toString() } : {}),
            ...(task.source.quote ? { quote: task.source.quote } : {}),
            ...(task.source.timestampMs !== undefined
              ? { timestampMs: task.source.timestampMs }
              : {})
          }
        }
      : {}),
    createdBy: task.createdBy.toString(),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

async function assertMeeting(projectId: string, meetingId: string, session?: ClientSession) {
  const query = Meeting.findOne({ _id: meetingId, projectId });
  if (session) query.session(session);
  const meeting = await query;
  if (!meeting) throw new ApiError(404, "NOT_FOUND", "Meeting was not found.");
  return meeting;
}

async function assertAssignee(
  projectId: string,
  assigneeId: string,
  session?: ClientSession
): Promise<void> {
  const query = Membership.exists({ projectId, userId: assigneeId });
  if (session) query.session(session);
  if (!(await query)) {
    throw new ApiError(400, "VALIDATION_ERROR", "The assignee must be a project member.");
  }
}

async function loadTimestamps(candidates: TaskCandidateDocument[]): Promise<TimestampMap> {
  const segmentIds = candidates.flatMap((candidate) =>
    candidate.segmentId ? [candidate.segmentId] : []
  );
  if (segmentIds.length === 0) return new Map();
  const segments = await TranscriptSegment.find({ _id: { $in: segmentIds } }).select({ startMs: 1 });
  return new Map(segments.map((segment) => [segment._id.toString(), segment.startMs]));
}

async function resolveTodoColumn(projectId: string, session: ClientSession): Promise<string> {
  const project = await Project.findById(projectId, { kanbanColumns: 1 }).session(session).lean();
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project was not found.");
  const column = [...project.kanbanColumns]
    .sort((left, right) => left.order - right.order)
    .find((item) => item.category === "todo");
  if (!column) {
    throw new ApiError(409, "CONFLICT", "The project does not have a Todo-category column.");
  }
  return column.id;
}

async function completeMeetingWhenReviewed(
  meetingId: Types.ObjectId,
  session: ClientSession
): Promise<boolean> {
  const remaining = await TaskCandidate.exists({
    meetingId,
    status: { $in: ["pending", "duplicate_pending"] }
  }).session(session);
  if (remaining) return false;
  const result = await Meeting.updateOne(
    { _id: meetingId, status: "ready_for_review" },
    { $set: { status: "completed" } },
    { session }
  );
  return result.modifiedCount === 1;
}

async function approveInSession(
  candidate: TaskCandidateRecord,
  userId: string,
  columnId: string,
  session: ClientSession
): Promise<{ candidate: TaskCandidateRecord; task: TaskDocument; timestampMs?: number }> {
  if (candidate.status === "duplicate_pending") {
    throw new ApiError(409, "CONFLICT", "Resolve the possible duplicate before approval.");
  }
  if (candidate.status !== "pending") {
    throw new ApiError(409, "CONFLICT", "Only pending candidates can be approved.");
  }
  if (candidate.suggestedAssigneeId) {
    await assertAssignee(
      candidate.projectId.toString(),
      candidate.suggestedAssigneeId.toString(),
      session
    );
  }

  const segment = candidate.segmentId
    ? await TranscriptSegment.findOne({
        _id: candidate.segmentId,
        meetingId: candidate.meetingId,
        projectId: candidate.projectId
      }).session(session)
    : null;
  if (candidate.segmentId && !segment) {
    throw new ApiError(409, "CONFLICT", "The candidate source segment is missing.");
  }

  const [task] = await Task.create(
    [
      {
        projectId: candidate.projectId,
        title: candidate.title,
        ...(candidate.description ? { description: candidate.description } : {}),
        assigneeIds: candidate.suggestedAssigneeId ? [candidate.suggestedAssigneeId] : [],
        ...(candidate.suggestedDueDate ? { dueDate: candidate.suggestedDueDate } : {}),
        priority: candidate.suggestedPriority,
        columnId,
        source: {
          meetingId: candidate.meetingId,
          ...(candidate.segmentId ? { segmentId: candidate.segmentId } : {}),
          quote: candidate.sourceQuote,
          ...(segment?.startMs !== undefined ? { timestampMs: segment.startMs } : {})
        },
        createdBy: userId,
        ...(candidate.embedding ? { embedding: candidate.embedding } : {})
      }
    ],
    { session }
  );
  if (!task) throw new ApiError(500, "INTERNAL_ERROR", "Candidate approval failed.");

  await TaskActivity.insertMany(
    [
      {
        projectId: candidate.projectId,
        taskId: task._id,
        actorType: "agent",
        type: "extracted",
        toValue: {
          meetingId: candidate.meetingId.toString(),
          ...(candidate.segmentId ? { segmentId: candidate.segmentId.toString() } : {})
        }
      },
      {
        projectId: candidate.projectId,
        taskId: task._id,
        actorId: userId,
        actorType: "user",
        type: "approved",
        toValue: { candidateId: candidate._id.toString() }
      }
    ],
    { session }
  );

  candidate.status = "approved";
  candidate.createdTaskId = task._id;
  await candidate.save({ session });
  return { candidate, task, ...(segment?.startMs !== undefined ? { timestampMs: segment.startMs } : {}) };
}

export async function listCandidates(
  projectId: string,
  meetingId: string,
  query: ListCandidatesQuery
): Promise<TaskCandidateResponse[]> {
  await assertMeeting(projectId, meetingId);
  const filter: Record<string, unknown> = { projectId, meetingId };
  if (query.status) filter.status = query.status;
  const candidates = await TaskCandidate.find(filter).sort({ createdAt: 1, _id: 1 });
  const [timestamps, duplicates] = await Promise.all([
    loadTimestamps(candidates),
    DuplicateCandidate.find({ taskCandidateId: { $in: candidates.map((candidate) => candidate._id) } })
  ]);
  const duplicateByCandidate = new Map(
    duplicates.map((duplicate) => [duplicate.taskCandidateId.toString(), duplicate])
  );
  return candidates.map((candidate) =>
    serializeCandidate(
      candidate,
      candidate.segmentId ? timestamps.get(candidate.segmentId.toString()) : undefined,
      duplicateByCandidate.get(candidate._id.toString())
    )
  );
}

export async function updateCandidate(
  projectId: string,
  meetingId: string,
  candidateId: string,
  userId: string,
  input: UpdateCandidateInput
): Promise<TaskCandidateResponse> {
  await assertMeeting(projectId, meetingId);
  if (input.suggestedAssigneeId) await assertAssignee(projectId, input.suggestedAssigneeId);

  const candidate = await TaskCandidate.findOne({ _id: candidateId, projectId, meetingId });
  if (!candidate) throw new ApiError(404, "NOT_FOUND", "Task candidate was not found.");
  if (candidate.status !== "pending") {
    throw new ApiError(
      409,
      "CONFLICT",
      candidate.status === "duplicate_pending"
        ? "Resolve the possible duplicate before editing."
        : "Reviewed candidates can no longer be edited."
    );
  }

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  for (const field of ["title", "suggestedPriority"] as const) {
    if (input[field] !== undefined) $set[field] = input[field];
  }
  for (const field of ["description", "suggestedAssigneeId", "suggestedDueDate"] as const) {
    if (input[field] === null) $unset[field] = 1;
    else if (input[field] !== undefined) $set[field] = input[field];
  }
  if (input.title !== undefined || input.description !== undefined) $unset.embedding = 1;
  const updated = await TaskCandidate.findOneAndUpdate(
    { _id: candidateId, projectId, meetingId, status: candidate.status },
    {
      ...(Object.keys($set).length > 0 ? { $set } : {}),
      ...(Object.keys($unset).length > 0 ? { $unset } : {})
    },
    { returnDocument: "after", runValidators: true }
  );
  if (!updated) throw new ApiError(409, "CONFLICT", "The candidate was reviewed concurrently.");
  const timestamp = updated.segmentId
    ? (await TranscriptSegment.findById(updated.segmentId).select({ startMs: 1 }))?.startMs
    : undefined;
  if (input.title !== undefined || input.description !== undefined) {
    await queueEmbeddingRefresh({
      projectId,
      initiatingUserId: userId,
      resourceId: updated._id.toString(),
      resourceKind: "candidate",
      title: updated.title,
      ...(updated.description ? { description: updated.description } : {}),
    });
  }
  return serializeCandidate(updated, timestamp);
}

export async function approveCandidate(
  projectId: string,
  meetingId: string,
  candidateId: string,
  userId: string
): Promise<CandidateApprovalResponse> {
  let approved: Awaited<ReturnType<typeof approveInSession>> | undefined;
  let meetingCompleted = false;
  await mongoose.connection.transaction(async (session) => {
    await assertMeeting(projectId, meetingId, session);
    const candidate = await TaskCandidate.findOne({ _id: candidateId, projectId, meetingId })
      .select("+embedding")
      .session(session);
    if (!candidate) throw new ApiError(404, "NOT_FOUND", "Task candidate was not found.");
    const columnId = await resolveTodoColumn(projectId, session);
    approved = await approveInSession(candidate, userId, columnId, session);
    meetingCompleted = await completeMeetingWhenReviewed(candidate.meetingId, session);
  });
  if (!approved) throw new ApiError(500, "INTERNAL_ERROR", "Candidate approval failed.");
  const task = serializeTask(approved.task);
  emitTaskCreated(projectId, task);
  if (meetingCompleted) emitMeetingProgress({ meetingId, projectId, status: "completed" });
  return {
    candidate: serializeCandidate(approved.candidate, approved.timestampMs),
    task
  };
}

export async function rejectCandidate(
  projectId: string,
  meetingId: string,
  candidateId: string
): Promise<TaskCandidateResponse> {
  let rejected: TaskCandidateRecord | undefined;
  let meetingCompleted = false;
  await mongoose.connection.transaction(async (session) => {
    await assertMeeting(projectId, meetingId, session);
    const candidate = await TaskCandidate.findOne({ _id: candidateId, projectId, meetingId }).session(
      session
    );
    if (!candidate) throw new ApiError(404, "NOT_FOUND", "Task candidate was not found.");
    if (candidate.status === "approved") {
      throw new ApiError(409, "CONFLICT", "Approved candidates cannot be rejected.");
    }
    candidate.status = "rejected";
    await candidate.save({ session });
    rejected = candidate;
    meetingCompleted = await completeMeetingWhenReviewed(candidate.meetingId, session);
  });
  if (!rejected) throw new ApiError(500, "INTERNAL_ERROR", "Candidate rejection failed.");
  const timestamp = rejected.segmentId
    ? (await TranscriptSegment.findById(rejected.segmentId).select({ startMs: 1 }))?.startMs
    : undefined;
  if (meetingCompleted) emitMeetingProgress({ meetingId, projectId, status: "completed" });
  return serializeCandidate(rejected, timestamp);
}

/** Returns a rejected candidate to the active review queue. */
export async function restoreCandidate(
  projectId: string,
  meetingId: string,
  candidateId: string
): Promise<TaskCandidateResponse> {
  let restored: TaskCandidateRecord | undefined;
  let restoredDuplicate: DuplicateCandidateRecord | undefined;
  let meetingReopened = false;
  await mongoose.connection.transaction(async (session) => {
    await assertMeeting(projectId, meetingId, session);
    const candidate = await TaskCandidate.findOne({ _id: candidateId, projectId, meetingId }).session(
      session
    );
    if (!candidate) throw new ApiError(404, "NOT_FOUND", "Task candidate was not found.");
    if (candidate.status !== "rejected") {
      throw new ApiError(409, "CONFLICT", "Only rejected candidates can be restored.");
    }

    const duplicate = await DuplicateCandidate.findOne({
      projectId,
      taskCandidateId: candidate._id,
      resolution: "ignored"
    }).session(session);
    if (duplicate) {
      duplicate.resolution = "pending";
      duplicate.resolvedBy = undefined;
      duplicate.resolvedAt = undefined;
      await duplicate.save({ session });
      candidate.status = "duplicate_pending";
      restoredDuplicate = duplicate;
    } else {
      candidate.status = "pending";
    }
    await candidate.save({ session });
    const result = await Meeting.updateOne(
      { _id: meetingId, projectId, status: "completed" },
      { $set: { status: "ready_for_review" } },
      { session }
    );
    meetingReopened = result.modifiedCount === 1;
    restored = candidate;
  });
  if (!restored) throw new ApiError(500, "INTERNAL_ERROR", "Candidate restore failed.");
  const timestamp = restored.segmentId
    ? (await TranscriptSegment.findById(restored.segmentId).select({ startMs: 1 }))?.startMs
    : undefined;
  if (meetingReopened) emitMeetingProgress({ meetingId, projectId, status: "ready_for_review" });
  return serializeCandidate(restored, timestamp, restoredDuplicate);
}

/** Permanently removes a handled item from review history without deleting its approved task. */
export async function deleteCandidate(
  projectId: string,
  meetingId: string,
  candidateId: string
): Promise<{ id: string }> {
  await mongoose.connection.transaction(async (session) => {
    await assertMeeting(projectId, meetingId, session);
    const candidate = await TaskCandidate.findOne({ _id: candidateId, projectId, meetingId }).session(
      session
    );
    if (!candidate) throw new ApiError(404, "NOT_FOUND", "Task candidate was not found.");
    if (candidate.status === "pending" || candidate.status === "duplicate_pending") {
      throw new ApiError(409, "CONFLICT", "Review or reject this candidate before removing it.");
    }
    await DuplicateCandidate.deleteMany({ projectId, taskCandidateId: candidate._id }).session(
      session
    );
    await candidate.deleteOne({ session });
  });
  return { id: candidateId };
}

export async function bulkApproveCandidates(
  projectId: string,
  meetingId: string,
  candidateIds: string[],
  userId: string
): Promise<{ candidates: TaskCandidateResponse[]; tasks: TaskResponse[] }> {
  const approvals: Array<Awaited<ReturnType<typeof approveInSession>>> = [];
  let meetingCompleted = false;
  await mongoose.connection.transaction(async (session) => {
    approvals.length = 0;
    const meeting = await assertMeeting(projectId, meetingId, session);
    const candidates = await TaskCandidate.find({
      _id: { $in: candidateIds },
      projectId,
      meetingId
    })
      .select("+embedding")
      .session(session);
    if (candidates.length !== candidateIds.length) {
      throw new ApiError(404, "NOT_FOUND", "One or more task candidates were not found.");
    }
    const byId = new Map(candidates.map((candidate) => [candidate._id.toString(), candidate]));
    const columnId = await resolveTodoColumn(projectId, session);
    for (const candidateId of candidateIds) {
      const candidate = byId.get(candidateId);
      if (!candidate) throw new ApiError(404, "NOT_FOUND", "Task candidate was not found.");
      approvals.push(await approveInSession(candidate, userId, columnId, session));
    }
    meetingCompleted = await completeMeetingWhenReviewed(meeting._id, session);
  });

  const tasks = approvals.map((approval) => serializeTask(approval.task));
  for (const task of tasks) emitTaskCreated(projectId, task);
  if (meetingCompleted) emitMeetingProgress({ meetingId, projectId, status: "completed" });
  return {
    candidates: approvals.map((approval) =>
      serializeCandidate(approval.candidate, approval.timestampMs)
    ),
    tasks
  };
}

export async function bulkRejectCandidates(
  projectId: string,
  meetingId: string,
  candidateIds: string[]
): Promise<TaskCandidateResponse[]> {
  let rejected: TaskCandidateRecord[] = [];
  let meetingCompleted = false;
  await mongoose.connection.transaction(async (session) => {
    const meeting = await assertMeeting(projectId, meetingId, session);
    const candidates = await TaskCandidate.find({
      _id: { $in: candidateIds },
      projectId,
      meetingId
    }).session(session);
    if (candidates.length !== candidateIds.length) {
      throw new ApiError(404, "NOT_FOUND", "One or more task candidates were not found.");
    }
    if (candidates.some((candidate) => candidate.status === "approved")) {
      throw new ApiError(409, "CONFLICT", "Approved candidates cannot be rejected.");
    }
    for (const candidate of candidates) candidate.status = "rejected";
    for (const candidate of candidates) await candidate.save({ session });
    rejected = candidates;
    meetingCompleted = await completeMeetingWhenReviewed(meeting._id, session);
  });
  const timestamps = await loadTimestamps(rejected);
  if (meetingCompleted) emitMeetingProgress({ meetingId, projectId, status: "completed" });
  return rejected.map((candidate) =>
    serializeCandidate(
      candidate,
      candidate.segmentId ? timestamps.get(candidate.segmentId.toString()) : undefined
    )
  );
}

export interface DuplicateResolutionResponse {
  duplicate: ReturnType<typeof serializeDuplicate>;
  candidate: TaskCandidateResponse;
  task?: TaskResponse;
}

/** Applies one explicit human duplicate decision; no AI proposal mutates a task by itself. */
export async function resolveDuplicate(
  projectId: string,
  duplicateId: string,
  userId: string,
  action: ResolveDuplicateInput["action"]
): Promise<DuplicateResolutionResponse> {
  let resolvedDuplicate: DuplicateCandidateRecord | undefined;
  let resolvedCandidate: TaskCandidateRecord | undefined;
  let affectedTask: TaskDocument | undefined;
  let createdSeparate = false;
  let sourceTimestampMs: number | undefined;
  let meetingCompleted = false;

  await mongoose.connection.transaction(async (session) => {
    const duplicate = await DuplicateCandidate.findOne({ _id: duplicateId, projectId })
      .select("+similarityScore")
      .session(session);
    if (!duplicate) throw new ApiError(404, "NOT_FOUND", "Duplicate suggestion was not found.");
    if (duplicate.resolution !== "pending") {
      throw new ApiError(409, "CONFLICT", "This duplicate suggestion was already resolved.");
    }

    const candidate = await TaskCandidate.findOne({
      _id: duplicate.taskCandidateId,
      projectId
    })
      .select("+embedding")
      .session(session);
    if (!candidate) throw new ApiError(409, "CONFLICT", "The linked candidate is missing.");
    if (candidate.status !== "duplicate_pending") {
      throw new ApiError(409, "CONFLICT", "The linked candidate is no longer awaiting resolution.");
    }
    await assertMeeting(projectId, candidate.meetingId.toString(), session);

    const existingTask = await Task.findOne({
      _id: duplicate.existingTaskId,
      projectId
    }).session(session);
    if (!existingTask) throw new ApiError(409, "CONFLICT", "The existing task is missing.");

    if (action === "create_separate") {
      candidate.status = "pending";
      const columnId = await resolveTodoColumn(projectId, session);
      const approval = await approveInSession(candidate, userId, columnId, session);
      affectedTask = approval.task;
      sourceTimestampMs = approval.timestampMs;
      duplicate.resolution = "created_separate";
      createdSeparate = true;
    } else if (action === "ignore") {
      candidate.status = "rejected";
      await candidate.save({ session });
      duplicate.resolution = "ignored";
    } else {
      await assertCanWorkOnTask(projectId, userId, existingTask, session);
      if (duplicate.differences.title) existingTask.title = candidate.title;
      if (duplicate.differences.priority) existingTask.priority = candidate.suggestedPriority;
      if (duplicate.differences.dueDate) {
        existingTask.dueDate = candidate.suggestedDueDate;
      }
      if (duplicate.differences.assigneeId) {
        if (candidate.suggestedAssigneeId) {
          await assertAssignee(projectId, candidate.suggestedAssigneeId.toString(), session);
        }
        existingTask.assigneeIds = candidate.suggestedAssigneeId ? [candidate.suggestedAssigneeId] : [];
        existingTask.assigneeId = undefined;
      }
      if (candidate.embedding) existingTask.embedding = candidate.embedding;
      await existingTask.save({ session });
      await TaskActivity.create(
        [
          {
            projectId,
            taskId: existingTask._id,
            actorId: userId,
            actorType: "user",
            type: "duplicate_resolved",
            fromValue: { duplicateId: duplicate._id.toString() },
            toValue: {
              action: "update_existing",
              candidateId: candidate._id.toString(),
              meetingId: candidate.meetingId.toString(),
              ...(candidate.segmentId ? { segmentId: candidate.segmentId.toString() } : {}),
              quote: candidate.sourceQuote,
              differences: duplicate.differences
            }
          }
        ],
        { session }
      );
      candidate.status = "approved";
      candidate.createdTaskId = existingTask._id;
      await candidate.save({ session });
      duplicate.resolution = "updated_existing";
      affectedTask = existingTask;
    }

    duplicate.resolvedBy = new mongoose.Types.ObjectId(userId);
    duplicate.resolvedAt = new Date();
    await duplicate.save({ session });
    meetingCompleted = await completeMeetingWhenReviewed(candidate.meetingId, session);
    resolvedDuplicate = duplicate;
    resolvedCandidate = candidate;
  });

  if (!resolvedDuplicate || !resolvedCandidate) {
    throw new ApiError(500, "INTERNAL_ERROR", "Duplicate resolution failed.");
  }
  if (affectedTask) {
    const taskResponse = serializeTask(affectedTask);
    if (createdSeparate) emitTaskCreated(projectId, taskResponse);
    else emitTaskUpdated(projectId, taskResponse);
  }
  if (meetingCompleted) {
    emitMeetingProgress({
      meetingId: resolvedCandidate.meetingId.toString(),
      projectId,
      status: "completed"
    });
  }

  return {
    duplicate: serializeDuplicate(resolvedDuplicate),
    candidate: serializeCandidate(resolvedCandidate, sourceTimestampMs, resolvedDuplicate),
    ...(affectedTask ? { task: serializeTask(affectedTask) } : {})
  };
}
