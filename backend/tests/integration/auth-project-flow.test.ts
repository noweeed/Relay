import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { Membership } from "../../src/models/Membership.model";
import { Project } from "../../src/models/Project.model";
import { RefreshSession } from "../../src/models/RefreshSession.model";
import { User } from "../../src/models/User.model";

describe("signup, login, and project acceptance flow", () => {
  let database: MongoMemoryReplSet;
  const app = createApp();

  beforeAll(async () => {
    // A replica set is used because project + owner creation is intentionally transactional.
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(database.getUri());
    await Promise.all([User.init(), RefreshSession.init(), Project.init(), Membership.init()]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("keeps projects private until an owner explicitly adds another user", async () => {
    const ownerPassword = "correct-horse-battery-staple";
    const ownerAgent = request.agent(app);

    const signupResponse = await ownerAgent.post("/api/auth/signup").send({
      name: "Owner User",
      email: "owner@example.com",
      password: ownerPassword
    });
    expect(signupResponse.status).toBe(201);
    expect(signupResponse.headers["set-cookie"]).toBeDefined();

    const loginResponse = await ownerAgent.post("/api/auth/login").send({
      email: "owner@example.com",
      password: ownerPassword
    });
    expect(loginResponse.status).toBe(200);
    const ownerAccessToken = loginResponse.body.data.accessToken as string;

    const createResponse = await ownerAgent
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Private Relay Project", description: "Authorization acceptance test" });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.role).toBe("owner");
    const projectId = createResponse.body.data.id as string;

    const listResponse = await ownerAgent
      .get("/api/projects")
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);

    const memberAgent = request.agent(app);
    const memberSignup = await memberAgent.post("/api/auth/signup").send({
      name: "Member User",
      email: "member@example.com",
      password: "another-secure-test-password"
    });
    const memberAccessToken = memberSignup.body.data.accessToken as string;

    const forbiddenResponse = await memberAgent
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${memberAccessToken}`);
    expect(forbiddenResponse.status).toBe(403);

    const inviteResponse = await ownerAgent
      .post(`/api/projects/${projectId}/members/invite`)
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ email: "member@example.com", role: "member" });
    expect(inviteResponse.status).toBe(201);

    const authorizedResponse = await memberAgent
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${memberAccessToken}`);
    expect(authorizedResponse.status).toBe(200);
    expect(authorizedResponse.body.data.role).toBe("member");

    const refreshResponse = await ownerAgent.post("/api/auth/refresh");
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.accessToken).toEqual(expect.any(String));
  });
});
