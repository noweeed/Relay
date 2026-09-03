import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { Membership } from "../../src/models/Membership.model";
import { Meeting } from "../../src/models/Meeting.model";
import { Project } from "../../src/models/Project.model";
import { RefreshSession } from "../../src/models/RefreshSession.model";
import { TaskCandidate } from "../../src/models/TaskCandidate.model";
import { Task } from "../../src/models/Task.model";
import { TaskActivity } from "../../src/models/TaskActivity.model";
import { TranscriptSegment } from "../../src/models/TranscriptSegment.model";
import { User } from "../../src/models/User.model";

describe("task candidate human-review flow", () => {
  let database: MongoMemoryReplSet;
  const app = createApp();

  beforeAll(async () => {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(database.getUri());
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      Project.init(),
      Membership.init(),
      Meeting.init(),
      TranscriptSegment.init(),
      TaskCandidate.init(),
      Task.init(),
      TaskActivity.init()
    ]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("edits, approves, rejects, and bulk reviews candidates with permanent task sources", async () => {
    const owner = request.agent(app);
    const outsider = request.agent(app);
    const ownerSignup = await owner.post("/api/auth/signup").send({
      name: "Review Owner",
      email: "review-owner@example.com",
      password: "review-owner-secure-password"
    });
    const ownerToken = ownerSignup.body.data.accessToken as string;
    const ownerId = ownerSignup.body.data.user.id as string;
    const outsiderSignup = await outsider.post("/api/auth/signup").send({
      name: "Review Outsider",
      email: "review-outsider@example.com",
      password: "review-outsider-secure-password"
    });
    const outsiderToken = outsiderSignup.body.data.accessToken as string;

    const projectResponse = await owner
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Review Project" });
    const projectId = projectResponse.body.data.id as string;
    const todoColumnId = (
      projectResponse.body.data.kanbanColumns as Array<{ id: string; category: string }>
    ).find((column) => column.category === "todo")!.id;

    const meeting = await Meeting.create({
      projectId,
      title: "Review planning",
      type: "transcript",
      status: "ready_for_review",
      rawInput: "Naveed: Ship the human review flow.",
      segmentCount: 1,
      createdBy: ownerId
    });
    const segment = await TranscriptSegment.create({
      projectId,
      meetingId: meeting._id,
      index: 0,
      speaker: "Naveed",
      text: "Ship the human review flow.",
      startMs: 42_000
    });
    const candidates = await TaskCandidate.insertMany(
      ["Edit and approve", "Reject", "Bulk approve", "Bulk reject"].map((title, index) => ({
        projectId,
        meetingId: meeting._id,
        segmentId: segment._id,
        title,
        suggestedPriority: "medium",
        sourceQuote: "Ship the human review flow.",
        status: "pending",
        sourceJobId: "review-job",
        sourceTaskIndex: index
      }))
    );
    const [editable, rejectable, bulkApprovable, bulkRejectable] = candidates;

    await outsider
      .get(`/api/projects/${projectId}/meetings/${meeting.id}/candidates`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(403);

    const listResponse = await owner
      .get(`/api/projects/${projectId}/meetings/${meeting.id}/candidates`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(4);
    expect(listResponse.body.data[0].sourceTimestampMs).toBe(42_000);

    const editResponse = await owner
      .patch(
        `/api/projects/${projectId}/meetings/${meeting.id}/candidates/${editable!._id}`
      )
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Ship reviewed extraction",
        suggestedAssigneeId: ownerId,
        suggestedDueDate: "2026-09-10",
        suggestedPriority: "high"
      });
    expect(editResponse.status).toBe(200);
    expect(editResponse.body.data.suggestedAssigneeId).toBe(ownerId);

    const approveResponse = await owner
      .post(
        `/api/projects/${projectId}/meetings/${meeting.id}/candidates/${editable!._id}/approve`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.task.title).toBe("Ship reviewed extraction");
    expect(approveResponse.body.data.task.columnId).toBe(todoColumnId);
    expect(approveResponse.body.data.task.source).toEqual({
      meetingId: meeting.id,
      segmentId: segment.id,
      quote: "Ship the human review flow.",
      timestampMs: 42_000
    });
    const taskId = approveResponse.body.data.task.id as string;
    expect(
      (await TaskActivity.find({ taskId }).sort({ createdAt: 1 })).map((activity) => activity.type)
    ).toEqual(["extracted", "approved"]);

    const rejectResponse = await owner
      .post(
        `/api/projects/${projectId}/meetings/${meeting.id}/candidates/${rejectable!._id}/reject`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.status).toBe("rejected");

    const bulkApproveResponse = await owner
      .post(`/api/projects/${projectId}/meetings/${meeting.id}/candidates/bulk-approve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ candidateIds: [bulkApprovable!._id.toString()] });
    expect(bulkApproveResponse.status).toBe(200);
    expect(bulkApproveResponse.body.data.tasks).toHaveLength(1);

    const bulkRejectResponse = await owner
      .post(`/api/projects/${projectId}/meetings/${meeting.id}/candidates/bulk-reject`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ candidateIds: [bulkRejectable!._id.toString()] });
    expect(bulkRejectResponse.status).toBe(200);
    expect(bulkRejectResponse.body.data[0].status).toBe("rejected");

    expect(await Task.countDocuments({ projectId, "source.meetingId": meeting._id })).toBe(2);
    expect((await Meeting.findById(meeting._id))?.status).toBe("completed");

    const reapproveResponse = await owner
      .post(
        `/api/projects/${projectId}/meetings/${meeting.id}/candidates/${editable!._id}/approve`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(reapproveResponse.status).toBe(409);
    expect(await Task.countDocuments({ projectId, "source.meetingId": meeting._id })).toBe(2);
  });
});
