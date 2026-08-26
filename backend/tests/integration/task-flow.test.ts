import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { Membership } from "../../src/models/Membership.model";
import { Project } from "../../src/models/Project.model";
import { RefreshSession } from "../../src/models/RefreshSession.model";
import { Task } from "../../src/models/Task.model";
import { TaskActivity } from "../../src/models/TaskActivity.model";
import { User } from "../../src/models/User.model";

describe("project-scoped Kanban task flow", () => {
  let database: MongoMemoryReplSet;
  const app = createApp();

  beforeAll(async () => {
    // Transactions need a replica set, matching the task + activity writes used in production.
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(database.getUri());
    await Promise.all([
      User.init(),
      RefreshSession.init(),
      Project.init(),
      Membership.init(),
      Task.init(),
      TaskActivity.init()
    ]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("supports a private task lifecycle with filters, grouping, roles, and activity", async () => {
    const owner = request.agent(app);
    const member = request.agent(app);
    const outsider = request.agent(app);

    const ownerSignup = await owner.post("/api/auth/signup").send({
      name: "Task Owner",
      email: "task-owner@example.com",
      password: "task-owner-secure-password"
    });
    const ownerToken = ownerSignup.body.data.accessToken as string;

    const memberSignup = await member.post("/api/auth/signup").send({
      name: "Task Member",
      email: "task-member@example.com",
      password: "task-member-secure-password"
    });
    const memberToken = memberSignup.body.data.accessToken as string;
    const memberId = memberSignup.body.data.user.id as string;

    const outsiderSignup = await outsider.post("/api/auth/signup").send({
      name: "Task Outsider",
      email: "task-outsider@example.com",
      password: "task-outsider-secure-password"
    });
    const outsiderToken = outsiderSignup.body.data.accessToken as string;

    const projectResponse = await owner
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Kanban Project" });
    const projectId = projectResponse.body.data.id as string;
    const defaultColumns = projectResponse.body.data.kanbanColumns as Array<{
      id: string;
      category: string;
    }>;
    const todoColumnId = defaultColumns.find((column) => column.category === "todo")!.id;
    const inProgressColumnId = defaultColumns.find(
      (column) => column.category === "in_progress"
    )!.id;

    await owner
      .post(`/api/projects/${projectId}/members/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "task-member@example.com", role: "member" });

    const createResponse = await owner
      .post(`/api/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Build Kanban API",
        description: "Implement task CRUD and activity",
        assigneeId: memberId,
        dueDate: "2026-09-01T12:00:00.000Z",
        priority: "high"
    });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.columnId).toBe(todoColumnId);
    expect(createResponse.body.data.assigneeId).toBe(memberId);
    const taskId = createResponse.body.data.id as string;

    const groupedResponse = await member
      .get(`/api/projects/${projectId}/tasks`)
      .query({
        groupBy: "column",
        priority: "high",
        q: "Kanban",
        dueBefore: "2026-09-02T00:00:00.000Z"
      })
      .set("Authorization", `Bearer ${memberToken}`);
    expect(groupedResponse.status).toBe(200);
    expect(groupedResponse.body.data.columns).toHaveLength(3);
    expect(
      groupedResponse.body.data.columns.find((column: { id: string }) => column.id === todoColumnId)
        .tasks
    ).toHaveLength(1);

    const updateResponse = await member
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ columnId: inProgressColumnId, priority: "medium", assigneeId: null });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.columnId).toBe(inProgressColumnId);
    expect(updateResponse.body.data.assigneeId).toBeUndefined();

    const activityResponse = await member
      .get(`/api/projects/${projectId}/tasks/${taskId}/activity`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(activityResponse.status).toBe(200);
    expect(activityResponse.body.data.map((event: { type: string }) => event.type)).toEqual([
      "created",
      "column_changed",
      "priority_changed",
      "assignee_changed"
    ]);

    const forbiddenRead = await outsider
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(forbiddenRead.status).toBe(403);

    const memberDelete = await member
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(memberDelete.status).toBe(403);

    const ownerDelete = await owner
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(ownerDelete.status).toBe(200);
    expect(await Task.exists({ _id: taskId })).toBeNull();
    expect(await TaskActivity.exists({ taskId })).toBeNull();
  });
});
