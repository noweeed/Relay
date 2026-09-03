import { rm } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { Membership } from "../../src/models/Membership.model";
import { Meeting } from "../../src/models/Meeting.model";
import { Project } from "../../src/models/Project.model";
import { RefreshSession } from "../../src/models/RefreshSession.model";
import { User } from "../../src/models/User.model";

const wav = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WAVEfmt "),
  Buffer.alloc(32)
]);

describe("audio meeting upload flow", () => {
  let database: MongoMemoryReplSet;
  const app = createApp();

  beforeAll(async () => {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(database.getUri());
    await Promise.all([User.init(), RefreshSession.init(), Project.init(), Membership.init(), Meeting.init()]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
    await rm(path.resolve(".relay-data/test-audio"), { recursive: true, force: true });
  });

  it("validates, stores, and serves project-private WAV audio", async () => {
    const owner = request.agent(app);
    const outsider = request.agent(app);
    const ownerSignup = await owner.post("/api/auth/signup").send({
      name: "Audio Owner",
      email: "audio-owner@example.com",
      password: "audio-owner-secure-password"
    });
    const outsiderSignup = await outsider.post("/api/auth/signup").send({
      name: "Audio Outsider",
      email: "audio-outsider@example.com",
      password: "audio-outsider-secure-password"
    });
    const ownerToken = ownerSignup.body.data.accessToken as string;
    const outsiderToken = outsiderSignup.body.data.accessToken as string;
    const project = await owner
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Audio Project" });
    const projectId = project.body.data.id as string;

    const upload = await owner
      .post(`/api/projects/${projectId}/meetings/audio`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .field("title", "Recorded planning")
      .attach("audio", wav, { filename: "../../Planning?.wav", contentType: "audio/wav" });

    expect(upload.status, JSON.stringify(upload.body)).toBe(201);
    expect(upload.body.data).toMatchObject({
      title: "Recorded planning",
      type: "audio",
      status: "created",
      segmentCount: 0,
      audioOriginalName: "Planning-.wav",
      audioMimeType: "audio/wav",
      audioSizeBytes: wav.length
    });
    expect(upload.body.data.audioUrl).toContain(`/meetings/${upload.body.data.id}/audio`);

    const audio = await owner
      .get(upload.body.data.audioUrl)
      .set("Authorization", `Bearer ${ownerToken}`)
      .buffer(true);
    expect(audio.status).toBe(200);
    expect(audio.headers["content-type"]).toContain("audio/wav");
    expect(Buffer.compare(audio.body as Buffer, wav)).toBe(0);

    await outsider
      .get(upload.body.data.audioUrl)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it("rejects spoofed and unsupported uploads", async () => {
    const user = request.agent(app);
    const signup = await user.post("/api/auth/signup").send({
      name: "Audio Validator",
      email: "audio-validator@example.com",
      password: "audio-validator-secure-password"
    });
    const token = signup.body.data.accessToken as string;
    const project = await user
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Validation Project" });
    const projectId = project.body.data.id as string;

    const spoofed = await user
      .post(`/api/projects/${projectId}/meetings/audio`)
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Spoofed recording")
      .attach("audio", Buffer.from("not actually audio"), { filename: "fake.wav", contentType: "audio/wav" });
    expect(spoofed.status).toBe(400);
    expect(spoofed.body.error.code).toBe("INVALID_AUDIO");

    const unsupported = await user
      .post(`/api/projects/${projectId}/meetings/audio`)
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Text upload")
      .attach("audio", Buffer.from("hello"), { filename: "notes.txt", contentType: "text/plain" });
    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error.code).toBe("INVALID_AUDIO");
  });
});
