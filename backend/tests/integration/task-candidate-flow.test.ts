import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { DuplicateCandidate } from "../../src/models/DuplicateCandidate.model";
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
      DuplicateCandidate.init(),
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

    const restoreResponse = await owner
      .post(
        `/api/projects/${projectId}/meetings/${meeting.id}/candidates/${rejectable!._id}/restore`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.data.status).toBe("pending");
    expect((await Meeting.findById(meeting._id))?.status).toBe("ready_for_review");

    await owner
      .delete(`/api/projects/${projectId}/meetings/${meeting.id}/candidates/${rejectable!._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(409);
    await owner
      .post(
        `/api/projects/${projectId}/meetings/${meeting.id}/candidates/${rejectable!._id}/reject`
      )
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    await owner
      .delete(`/api/projects/${projectId}/meetings/${meeting.id}/candidates/${rejectable!._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    await owner
      .delete(`/api/projects/${projectId}/meetings/${meeting.id}/candidates/${editable!._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(await TaskCandidate.exists({ _id: { $in: [rejectable!._id, editable!._id] } })).toBeNull();
    expect(await Task.countDocuments({ projectId, "source.meetingId": meeting._id })).toBe(2);
  });

  it("resolves duplicate suggestions only through explicit project-member actions", async () => {
    const owner = request.agent(app);
    const outsider = request.agent(app);
    const ownerSignup = await owner.post("/api/auth/signup").send({
      name: "Duplicate Owner",
      email: "duplicate-owner@example.com",
      password: "duplicate-owner-secure-password"
    });
    const ownerToken = ownerSignup.body.data.accessToken as string;
    const ownerId = ownerSignup.body.data.user.id as string;
    const outsiderSignup = await outsider.post("/api/auth/signup").send({
      name: "Duplicate Outsider",
      email: "duplicate-outsider@example.com",
      password: "duplicate-outsider-secure-password"
    });
    const outsiderToken = outsiderSignup.body.data.accessToken as string;

    const projectResponse = await owner
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Duplicate Project" });
    const projectId = projectResponse.body.data.id as string;
    const todoColumnId = (
      projectResponse.body.data.kanbanColumns as Array<{ id: string; category: string }>
    ).find((column) => column.category === "todo")!.id;
    const existing = await Task.create({
      projectId,
      title: "Finish authentication backend",
      dueDate: new Date("2026-09-08T00:00:00.000Z"),
      priority: "medium",
      columnId: todoColumnId,
      embedding: [0.1, 0.2],
      createdBy: ownerId
    });
    const meeting = await Meeting.create({
      projectId,
      title: "Later planning",
      type: "transcript",
      status: "ready_for_review",
      rawInput: "Finish authentication API by Friday.",
      segmentCount: 1,
      createdBy: ownerId
    });
    const segment = await TranscriptSegment.create({
      projectId,
      meetingId: meeting._id,
      index: 0,
      text: "Finish authentication API by Friday."
    });
    const candidates = await TaskCandidate.insertMany(
      [
        { title: "Finish authentication API", dueDate: "2026-09-11", priority: "high" },
        { title: "Document authentication API", dueDate: "2026-09-12", priority: "medium" },
        { title: "Discuss authentication API", dueDate: null, priority: "low" }
      ].map((item, index) => ({
        projectId,
        meetingId: meeting._id,
        segmentId: segment._id,
        title: item.title,
        ...(item.dueDate ? { suggestedDueDate: new Date(`${item.dueDate}T00:00:00.000Z`) } : {}),
        suggestedPriority: item.priority,
        sourceQuote: "Finish authentication API by Friday.",
        status: "duplicate_pending",
        sourceJobId: "duplicate-job",
        sourceTaskIndex: index,
        embedding: [0.1, 0.2]
      }))
    );
    const duplicates = await DuplicateCandidate.insertMany(
      candidates.map((candidate, index) => ({
        projectId,
        taskCandidateId: candidate._id,
        existingTaskId: existing._id,
        similarityLabel: index === 0 ? "high" : "medium",
        similarityScore: index === 0 ? 0.92 : 0.8,
        differences: {
          title: { existing: existing.title, candidate: candidate.title },
          dueDate: {
            existing: existing.dueDate?.toISOString() ?? null,
            candidate: candidate.suggestedDueDate?.toISOString() ?? null
          },
          priority: { existing: existing.priority, candidate: candidate.suggestedPriority }
        },
        resolution: "pending"
      }))
    );

    const list = await owner
      .get(`/api/projects/${projectId}/meetings/${meeting.id}/candidates`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.data[0].duplicate).toMatchObject({
      id: duplicates[0]!._id.toString(),
      existingTaskId: existing._id.toString(),
      similarityLabel: "high",
      resolution: "pending"
    });
    expect(list.body.data[0].duplicate).not.toHaveProperty("similarityScore");

    await outsider
      .post(`/api/projects/${projectId}/duplicates/${duplicates[0]!._id}/resolve`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ action: "update_existing" })
      .expect(403);

    const update = await owner
      .post(`/api/projects/${projectId}/duplicates/${duplicates[0]!._id}/resolve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ action: "update_existing" })
      .expect(200);
    expect(update.body.data.duplicate.resolution).toBe("updated_existing");
    expect(update.body.data.task).toMatchObject({
      id: existing._id.toString(),
      title: "Finish authentication API",
      priority: "high"
    });
    expect(update.body.data.task.dueDate).toContain("2026-09-11");

    const separate = await owner
      .post(`/api/projects/${projectId}/duplicates/${duplicates[1]!._id}/resolve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ action: "create_separate" })
      .expect(200);
    expect(separate.body.data.duplicate.resolution).toBe("created_separate");
    expect(separate.body.data.task.id).not.toBe(existing._id.toString());
    expect((await Task.findById(separate.body.data.task.id).select("+embedding"))?.embedding).toEqual([
      0.1,
      0.2
    ]);

    const ignored = await owner
      .post(`/api/projects/${projectId}/duplicates/${duplicates[2]!._id}/resolve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ action: "ignore" })
      .expect(200);
    expect(ignored.body.data.duplicate.resolution).toBe("ignored");
    expect(ignored.body.data.candidate.status).toBe("rejected");
    expect((await Meeting.findById(meeting._id))?.status).toBe("completed");

    await owner
      .post(`/api/projects/${projectId}/duplicates/${duplicates[0]!._id}/resolve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ action: "update_existing" })
      .expect(409);
    const activity = await TaskActivity.findOne({
      taskId: existing._id,
      type: "duplicate_resolved"
    }).lean();
    expect(activity?.toValue).toMatchObject({
      meetingId: meeting._id.toString(),
      quote: "Finish authentication API by Friday."
    });
  });
});
