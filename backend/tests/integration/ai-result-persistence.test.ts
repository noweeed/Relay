import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AiResultEnvelope } from "../../src/contracts/ai.contract";
import { AiJobLedger } from "../../src/models/AiJobLedger.model";
import { Meeting } from "../../src/models/Meeting.model";
import { Membership } from "../../src/models/Membership.model";
import { TaskCandidate } from "../../src/models/TaskCandidate.model";
import { TranscriptSegment } from "../../src/models/TranscriptSegment.model";
import { User } from "../../src/models/User.model";
import { persistAiResult } from "../../src/services/ai-result-persistence.service";

describe("AI result persistence", () => {
  let database: MongoMemoryReplSet;

  beforeAll(async () => {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(database.getUri());
    await Promise.all([
      User.init(),
      Membership.init(),
      Meeting.init(),
      TranscriptSegment.init(),
      TaskCandidate.init(),
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
});
