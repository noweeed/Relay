import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AiResultEnvelope } from "../../src/contracts/ai.contract";
import { AiJobLedger } from "../../src/models/AiJobLedger.model";
import { DuplicateCandidate } from "../../src/models/DuplicateCandidate.model";
import { Meeting } from "../../src/models/Meeting.model";
import { Membership } from "../../src/models/Membership.model";
import { Project } from "../../src/models/Project.model";
import { TaskCandidate } from "../../src/models/TaskCandidate.model";
import { Task } from "../../src/models/Task.model";
import { TranscriptSegment } from "../../src/models/TranscriptSegment.model";
import { User } from "../../src/models/User.model";
import { persistAiResult } from "../../src/services/ai-result-persistence.service";
import { hashEmbeddingContent } from "../../src/services/embedding-refresh.service";

describe("AI result persistence", () => {
  let database: MongoMemoryReplSet;

  beforeAll(async () => {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(database.getUri());
    await Promise.all([
      User.init(),
      Membership.init(),
      Meeting.init(),
      Project.init(),
      Task.init(),
      TranscriptSegment.init(),
      TaskCandidate.init(),
      DuplicateCandidate.init(),
      AiJobLedger.init()
    ]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("stores traceable candidates, matches assignees, and ignores a replay", async () => {
    const projectId = new mongoose.Types.ObjectId();
    const user = await User.create({
      name: "Naveed",
      email: "ai-result@example.com",
      passwordHash: "not-used",
      hasPassword: true
    });
    await Membership.create({ projectId, userId: user._id, role: "owner", teamRole: "Developer" });
    const meeting = await Meeting.create({
      projectId,
      title: "Planning",
      status: "processing",
      rawInput: "Naveed: I will finish authentication.",
      segmentCount: 1,
      createdBy: user._id,
      activeAiJobId: "job-1"
    });
    const segment = await TranscriptSegment.create({
      projectId,
      meetingId: meeting._id,
      index: 0,
      speaker: "Naveed",
      text: "I will finish authentication."
    });
    const result: AiResultEnvelope = {
      jobId: "job-1",
      jobType: "meeting.process",
      schemaVersion: 1,
      projectId: projectId.toString(),
      resourceId: meeting._id.toString(),
      status: "succeeded",
      completedAt: new Date().toISOString(),
      payload: {
        meetingId: meeting._id.toString(),
        tasks: [
          {
            title: "Finish authentication",
            assigneeName: "Naveed",
            dueDate: "2026-08-30",
            priority: "high",
            segmentOrder: 0,
            sourceQuote: "I will finish authentication.",
            confidence: 0.9
          }
        ]
      }
    };

    await expect(persistAiResult(result)).resolves.toBe("persisted");
    const candidate = await TaskCandidate.findOne({ meetingId: meeting._id }).select("+confidence");
    expect(candidate?.segmentId?.toString()).toBe(segment._id.toString());
    expect(candidate?.suggestedAssigneeId?.toString()).toBe(user._id.toString());
    expect(candidate?.sourceJobId).toBe("job-1");
    expect(candidate?.confidence).toBe(0.9);
    expect((await Meeting.findById(meeting._id))?.status).toBe("ready_for_review");

    await expect(persistAiResult(result)).resolves.toBe("ignored_duplicate");
    expect(await TaskCandidate.countDocuments({ meetingId: meeting._id })).toBe(1);
    expect(await AiJobLedger.countDocuments({ jobId: "job-1" })).toBe(1);
  });

  it("records a terminal worker failure and makes the meeting retryable", async () => {
    const projectId = new mongoose.Types.ObjectId();
    const user = await User.create({
      name: "Failure Owner",
      email: "ai-failure@example.com",
      passwordHash: "not-used",
      hasPassword: true
    });
    const meeting = await Meeting.create({
      projectId,
      title: "Failed planning",
      status: "processing",
      rawInput: "A provider will fail.",
      segmentCount: 1,
      createdBy: user._id,
      activeAiJobId: "job-failure"
    });
    const result: AiResultEnvelope = {
      jobId: "job-failure",
      jobType: "meeting.process",
      schemaVersion: 1,
      projectId: projectId.toString(),
      resourceId: meeting._id.toString(),
      status: "failed",
      completedAt: new Date().toISOString(),
      error: {
        code: "AI_PROCESSING_FAILED",
        message: "Meeting task extraction failed. You can retry this meeting.",
        retryable: true
      }
    };

    await expect(persistAiResult(result)).resolves.toBe("persisted");
    const failedMeeting = await Meeting.findById(meeting._id);
    expect(failedMeeting?.status).toBe("failed");
    expect(failedMeeting?.errorMessage).toContain("retry");
    await expect(persistAiResult(result)).resolves.toBe("ignored_duplicate");
  });

  it("persists timestamped audio segments before creating traceable candidates", async () => {
    const projectId = new mongoose.Types.ObjectId();
    const user = await User.create({
      name: "Audio Owner",
      email: "audio-result@example.com",
      passwordHash: "not-used",
      hasPassword: true
    });
    await Membership.create({ projectId, userId: user._id, role: "owner", teamRole: "Owner" });
    const meeting = await Meeting.create({
      projectId,
      title: "Recorded planning",
      type: "audio",
      status: "processing",
      audioStorageKey: "00000000-0000-4000-8000-000000000001.wav",
      audioOriginalName: "planning.wav",
      audioMimeType: "audio/wav",
      audioSizeBytes: 44,
      segmentCount: 0,
      createdBy: user._id,
      activeAiJobId: "audio-job-1"
    });
    const result: AiResultEnvelope = {
      jobId: "audio-job-1",
      jobType: "meeting.transcribe",
      schemaVersion: 1,
      projectId: projectId.toString(),
      resourceId: meeting._id.toString(),
      status: "succeeded",
      completedAt: new Date().toISOString(),
      payload: {
        meetingId: meeting._id.toString(),
        transcript: [{
          order: 0,
          speaker: "Speaker 1",
          text: "I will finish the audio pipeline.",
          startMs: 250,
          endMs: 2800
        }],
        tasks: [{
          title: "Finish audio pipeline",
          priority: "medium",
          segmentOrder: 0,
          sourceQuote: "I will finish the audio pipeline."
        }]
      }
    };

    await expect(persistAiResult(result)).resolves.toBe("persisted");
    const segment = await TranscriptSegment.findOne({ meetingId: meeting._id });
    const candidate = await TaskCandidate.findOne({ meetingId: meeting._id });
    const updatedMeeting = await Meeting.findById(meeting._id);
    expect(segment).toMatchObject({ index: 0, speaker: "Speaker 1", startMs: 250, endMs: 2800 });
    expect(candidate?.segmentId.toString()).toBe(segment?._id.toString());
    expect(updatedMeeting).toMatchObject({ status: "ready_for_review", segmentCount: 1 });
  });

  it("stores candidate embeddings and project-scoped duplicate proposals transactionally", async () => {
    const user = await User.create({
      name: "Duplicate Result Owner",
      email: "duplicate-result@example.com",
      passwordHash: "not-used",
      hasPassword: true
    });
    const project = await Project.create({ name: "Duplicate result", createdBy: user._id });
    const todoColumnId = project.kanbanColumns.find((column) => column.category === "todo")!.id;
    await Membership.create({
      projectId: project._id,
      userId: user._id,
      role: "owner",
      teamRole: "Owner"
    });
    const existing = await Task.create({
      projectId: project._id,
      title: "Complete authentication backend",
      dueDate: new Date("2026-09-08T00:00:00.000Z"),
      priority: "medium",
      columnId: todoColumnId,
      embedding: [0.1, 0.2, 0.3],
      createdBy: user._id
    });
    const meeting = await Meeting.create({
      projectId: project._id,
      title: "Follow-up planning",
      status: "processing",
      rawInput: "Finish authentication API by Friday.",
      segmentCount: 1,
      createdBy: user._id,
      activeAiJobId: "duplicate-result-job"
    });
    await TranscriptSegment.create({
      projectId: project._id,
      meetingId: meeting._id,
      index: 0,
      text: "Finish authentication API by Friday."
    });
    const result: AiResultEnvelope = {
      jobId: "duplicate-result-job",
      jobType: "meeting.process",
      schemaVersion: 1,
      projectId: project._id.toString(),
      resourceId: meeting._id.toString(),
      status: "succeeded",
      completedAt: new Date().toISOString(),
      payload: {
        meetingId: meeting._id.toString(),
        tasks: [{
          title: "Finish authentication API",
          dueDate: "2026-09-11",
          priority: "high",
          segmentOrder: 0,
          sourceQuote: "Finish authentication API by Friday.",
          embedding: [0.1, 0.2, 0.3],
          duplicate: {
            existingTaskId: existing._id.toString(),
            similarityLabel: "high",
            similarityScore: 0.92
          }
        }]
      }
    };

    await expect(persistAiResult(result)).resolves.toBe("persisted");
    const candidate = await TaskCandidate.findOne({ meetingId: meeting._id }).select("+embedding");
    const duplicate = await DuplicateCandidate.findOne({ taskCandidateId: candidate?._id });
    expect(candidate).toMatchObject({ status: "duplicate_pending", embedding: [0.1, 0.2, 0.3] });
    expect(duplicate).toMatchObject({
      existingTaskId: existing._id,
      similarityLabel: "high",
      resolution: "pending"
    });
    expect(duplicate?.differences.dueDate).toMatchObject({
      existing: "2026-09-08T00:00:00.000Z",
      candidate: "2026-09-11T00:00:00.000Z"
    });
  });

  it("applies only an embedding for the current task text", async () => {
    const user = await User.create({
      name: "Embedding Owner",
      email: "embedding-owner@example.com",
      passwordHash: "not-used",
      hasPassword: true,
    });
    const project = await Project.create({ name: "Embedding project", createdBy: user._id });
    const task = await Task.create({
      projectId: project._id,
      title: "Current title",
      description: "Current description",
      priority: "medium",
      columnId: project.kanbanColumns[0]!.id,
      createdBy: user._id,
    });
    const base = {
      jobType: "content.embed" as const,
      schemaVersion: 1 as const,
      projectId: project._id.toString(),
      resourceId: task._id.toString(),
      status: "succeeded" as const,
      completedAt: new Date().toISOString(),
    };

    await expect(
      persistAiResult({
        ...base,
        jobId: "stale-embedding-job",
        payload: {
          resourceId: task._id.toString(),
          resourceKind: "task",
          contentHash: "a".repeat(64),
          embedding: [0.1, 0.2],
        },
      }),
    ).resolves.toBe("ignored_stale");
    await expect(
      persistAiResult({
        ...base,
        jobId: "current-embedding-job",
        payload: {
          resourceId: task._id.toString(),
          resourceKind: "task",
          contentHash: hashEmbeddingContent(task.title, task.description),
          embedding: [0.3, 0.4],
        },
      }),
    ).resolves.toBe("persisted");

    expect((await Task.findById(task._id).select("+embedding"))?.embedding).toEqual([0.3, 0.4]);
  });
});
