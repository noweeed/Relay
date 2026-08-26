import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { Membership } from "../../src/models/Membership.model";
import { Meeting } from "../../src/models/Meeting.model";
import { Project } from "../../src/models/Project.model";
import { RefreshSession } from "../../src/models/RefreshSession.model";
import { TranscriptSegment } from "../../src/models/TranscriptSegment.model";
import { User } from "../../src/models/User.model";

describe("meeting transcript flow", () => {
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
      TranscriptSegment.init()
    ]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("allows a member to paste, list, retrieve, and manage a meeting transcript", async () => {
    const owner = request.agent(app);
    const member = request.agent(app);
    const outsider = request.agent(app);

    // --- Setup: register users and create project ---

    const ownerSignup = await owner.post("/api/auth/signup").send({
      name: "Meeting Owner",
      email: "meeting-owner@example.com",
      password: "meeting-owner-secure-password"
    });
    const ownerToken = ownerSignup.body.data.accessToken as string;

    const memberSignup = await member.post("/api/auth/signup").send({
      name: "Meeting Member",
      email: "meeting-member@example.com",
      password: "meeting-member-secure-password"
    });
    const memberToken = memberSignup.body.data.accessToken as string;

    const outsiderSignup = await outsider.post("/api/auth/signup").send({
      name: "Meeting Outsider",
      email: "meeting-outsider@example.com",
      password: "meeting-outsider-secure-password"
    });
    const outsiderToken = outsiderSignup.body.data.accessToken as string;

    const projectRes = await owner
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Meeting Project" });
    const projectId = projectRes.body.data.id as string;

    await owner
      .post(`/api/projects/${projectId}/members/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "meeting-member@example.com", role: "member" });

    // --- Create meeting with pasted transcript ---

    const transcript = [
      "Naveed: Let's discuss the auth refactor",
      "Sarah: I think we should use OAuth",
      "Naveed: Agreed, I'll handle the implementation",
      "Sarah: I'll write the tests for it"
    ].join("\n");

    const createRes = await member
      .post(`/api/projects/${projectId}/meetings`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ title: "Sprint Planning", transcript });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.title).toBe("Sprint Planning");
    expect(createRes.body.data.status).toBe("created");
    expect(createRes.body.data.segmentCount).toBeGreaterThan(0);
    const meetingId = createRes.body.data.id as string;

    // --- Outsider cannot access meetings ---

    const outsiderList = await outsider
      .get(`/api/projects/${projectId}/meetings`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(outsiderList.status).toBe(403);

    // --- List meetings ---

    const listRes = await member
      .get(`/api/projects/${projectId}/meetings`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].title).toBe("Sprint Planning");

    // --- Get meeting detail ---

    const detailRes = await member
      .get(`/api/projects/${projectId}/meetings/${meetingId}`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(meetingId);
    expect(detailRes.body.data.type).toBe("transcript");

    // --- Get transcript segments ---

    const transcriptRes = await member
      .get(`/api/projects/${projectId}/meetings/${meetingId}/transcript`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(transcriptRes.status).toBe(200);
    const segments = transcriptRes.body.data;
    expect(segments.length).toBeGreaterThan(0);

    // Segments should be ordered by index.
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].index).toBeGreaterThan(segments[i - 1].index);
    }

    // Speaker labels should be parsed for the labeled transcript.
    const speakers = segments
      .filter((segment: { speaker?: string }) => segment.speaker)
      .map((segment: { speaker: string }) => segment.speaker);
    expect(speakers).toContain("Naveed");
    expect(speakers).toContain("Sarah");

    // --- Meeting-to-tasks (empty at first) ---

    const tasksRes = await member
      .get(`/api/projects/${projectId}/meetings/${meetingId}/tasks`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(tasksRes.status).toBe(200);
    expect(tasksRes.body.data).toHaveLength(0);

    // --- Status transitions ---

    // Member cannot change status (requires owner/admin).
    const memberStatusRes = await member
      .patch(`/api/projects/${projectId}/meetings/${meetingId}/status`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ status: "processing" });
    expect(memberStatusRes.status).toBe(403);

    // Owner can advance status.
    const processingRes = await owner
      .patch(`/api/projects/${projectId}/meetings/${meetingId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "processing" });
    expect(processingRes.status).toBe(200);
    expect(processingRes.body.data.status).toBe("processing");

    // Invalid transition: processing → completed (must go through ready_for_review).
    const invalidRes = await owner
      .patch(`/api/projects/${projectId}/meetings/${meetingId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "completed" });
    expect(invalidRes.status).toBe(409);

    // Advance to failed.
    const failedRes = await owner
      .patch(`/api/projects/${projectId}/meetings/${meetingId}/status`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "failed" });
    expect(failedRes.status).toBe(200);
    expect(failedRes.body.data.status).toBe("failed");

    // --- Reprocess ---

    // Member cannot reprocess.
    const memberReprocessRes = await member
      .post(`/api/projects/${projectId}/meetings/${meetingId}/reprocess`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(memberReprocessRes.status).toBe(403);

    // Owner can reprocess a failed meeting.
    const reprocessRes = await owner
      .post(`/api/projects/${projectId}/meetings/${meetingId}/reprocess`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(reprocessRes.status).toBe(200);
    expect(reprocessRes.body.data.status).toBe("created");

    // --- Filter by status ---

    const filteredRes = await member
      .get(`/api/projects/${projectId}/meetings?status=created`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.data).toHaveLength(1);

    const emptyFilter = await member
      .get(`/api/projects/${projectId}/meetings?status=completed`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(emptyFilter.status).toBe(200);
    expect(emptyFilter.body.data).toHaveLength(0);

    // Project deletion must not leave private transcript data orphaned in MongoDB.
    await owner
      .delete(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(await Meeting.exists({ _id: meetingId })).toBeNull();
    expect(await TranscriptSegment.exists({ meetingId })).toBeNull();
  });
});
