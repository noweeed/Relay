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
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      Project.init(),
      Membership.init(),
    ]);
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
      password: ownerPassword,
    });
    expect(signupResponse.status).toBe(201);
    expect(signupResponse.headers["set-cookie"]).toBeDefined();

    const loginResponse = await ownerAgent.post("/api/auth/login").send({
      email: "owner@example.com",
      password: ownerPassword,
    });
    expect(loginResponse.status).toBe(200);
    const ownerAccessToken = loginResponse.body.data.accessToken as string;

    const createResponse = await ownerAgent
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({
        name: "Private Relay Project",
        description: "Authorization acceptance test",
      });
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
      password: "another-secure-test-password",
    });
    const memberAccessToken = memberSignup.body.data.accessToken as string;

    const forbiddenResponse = await memberAgent
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${memberAccessToken}`);
    expect(forbiddenResponse.status).toBe(403);

    const inviteResponse = await ownerAgent
      .post(`/api/projects/${projectId}/members/invite`)
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({
        email: "member@example.com",
        role: "member",
        teamRole: "Frontend engineer",
      });
    expect(inviteResponse.status).toBe(201);
    expect(inviteResponse.body.data.teamRole).toBe("Frontend engineer");

    const memberId = memberSignup.body.data.user.id as string;
    const forbiddenTeamRoleEdit = await memberAgent
      .patch(`/api/projects/${projectId}/members/${memberId}`)
      .set("Authorization", `Bearer ${memberAccessToken}`)
      .send({ teamRole: "Unauthorized edit" });
    expect(forbiddenTeamRoleEdit.status).toBe(403);

    const teamRoleEdit = await ownerAgent
      .patch(`/api/projects/${projectId}/members/${memberId}`)
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ teamRole: "Senior frontend engineer" });
    expect(teamRoleEdit.status).toBe(200);
    expect(teamRoleEdit.body.data.role).toBe("member");
    expect(teamRoleEdit.body.data.teamRole).toBe("Senior frontend engineer");

    const memberList = await ownerAgent
      .get(`/api/projects/${projectId}/members`)
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    expect(memberList.status).toBe(200);
    expect(memberList.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: memberId,
          teamRole: "Senior frontend engineer",
        }),
      ]),
    );

    const authorizedResponse = await memberAgent
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${memberAccessToken}`);
    expect(authorizedResponse.status).toBe(200);
    expect(authorizedResponse.body.data.role).toBe("member");

    const refreshResponse = await ownerAgent.post("/api/auth/refresh");
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.accessToken).toEqual(expect.any(String));

    const profileUpdate = await ownerAgent
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Updated Owner" });
    expect(profileUpdate.status).toBe(200);
    expect(profileUpdate.body.data.name).toBe("Updated Owner");

    const preferences = {
      upcomingDeadlines: true,
      overdueTasks: false,
      meetingProcessing: true,
      reviewQueue: true,
      mentionsAndAssignments: true,
      weeklyDigest: false,
      emailNotifications: true,
      inAppNotifications: true,
    };
    const preferenceUpdate = await ownerAgent
      .put("/api/auth/me/notifications")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send(preferences);
    expect(preferenceUpdate.status).toBe(200);
    expect(
      preferenceUpdate.body.data.notificationPreferences.overdueTasks,
    ).toBe(false);

    const passwordUpdate = await ownerAgent
      .patch("/api/auth/me/password")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({
        currentPassword: ownerPassword,
        newPassword: "new-owner-password-123",
      });
    expect(passwordUpdate.status).toBe(200);
    const updatedOwnerToken = passwordUpdate.body.data.accessToken as string;

    const blockedDeletion = await ownerAgent
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${updatedOwnerToken}`)
      .send({ currentPassword: "new-owner-password-123" });
    expect(blockedDeletion.status).toBe(409);

    const transfer = await ownerAgent
      .post(`/api/projects/${projectId}/transfer-ownership`)
      .set("Authorization", `Bearer ${updatedOwnerToken}`)
      .send({ userId: memberId });
    expect(transfer.status).toBe(200);

    const memberOwnedProject = await memberAgent
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${memberAccessToken}`);
    expect(memberOwnedProject.body.data.role).toBe("owner");

    const deleteAccount = await ownerAgent
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${updatedOwnerToken}`)
      .send({ currentPassword: "new-owner-password-123" });
    expect(deleteAccount.status).toBe(200);
    expect(await User.exists({ email: "owner@example.com" })).toBeNull();
    expect(await Project.exists({ _id: projectId })).not.toBeNull();
  }, 30_000);
});
