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

interface ColumnResponse {
  id: string;
  name: string;
  color: string;
  category: "todo" | "in_progress" | "done";
  order: number;
}

describe("custom Kanban column configuration", () => {
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
      Task.init(),
      TaskActivity.init()
    ]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("lets owners and admins configure a safe project-specific workflow", async () => {
    const owner = request.agent(app);
    const admin = request.agent(app);
    const member = request.agent(app);
    const outsider = request.agent(app);

    const signup = async (
      agent: ReturnType<typeof request.agent>,
      name: string,
      email: string
    ): Promise<string> => {
      const response = await agent.post("/api/auth/signup").send({
        name,
        email,
        password: `${name.toLowerCase().replaceAll(" ", "-")}-secure-password`
      });
      return response.body.data.accessToken as string;
    };

    const ownerToken = await signup(owner, "Column Owner", "column-owner@example.com");
    const adminToken = await signup(admin, "Column Admin", "column-admin@example.com");
    const memberToken = await signup(member, "Column Member", "column-member@example.com");
    const outsiderToken = await signup(outsider, "Column Outsider", "column-outsider@example.com");

    const projectResponse = await owner
      .post("/api/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Custom Workflow Project" });
    expect(projectResponse.status).toBe(201);
    const projectId = projectResponse.body.data.id as string;
    const defaults = projectResponse.body.data.kanbanColumns as ColumnResponse[];
    expect(defaults.map((column) => column.name)).toEqual(["Todo", "In Progress", "Done"]);
    const todoColumn = defaults.find((column) => column.category === "todo")!;
    const inProgressColumn = defaults.find((column) => column.category === "in_progress")!;

    await owner
      .post(`/api/projects/${projectId}/members/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "column-admin@example.com", role: "admin" });
    await owner
      .post(`/api/projects/${projectId}/members/invite`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "column-member@example.com", role: "member" });

    const memberList = await member
      .get(`/api/projects/${projectId}/kanban/columns`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(memberList.status).toBe(200);
    expect(memberList.body.data).toHaveLength(3);

    const forbiddenCreate = await member
      .post(`/api/projects/${projectId}/kanban/columns`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ name: "Review", color: "#A855F7", category: "in_progress" });
    expect(forbiddenCreate.status).toBe(403);

    const invalidColor = await admin
      .post(`/api/projects/${projectId}/kanban/columns`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Review", color: "purple", category: "in_progress" });
    expect(invalidColor.status).toBe(400);

    const customResponse = await admin
      .post(`/api/projects/${projectId}/kanban/columns`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Code Review", color: "#A855F7", category: "in_progress" });
    expect(customResponse.status).toBe(201);
    const customColumn = customResponse.body.data as ColumnResponse;

    const duplicateName = await owner
      .post(`/api/projects/${projectId}/kanban/columns`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "code review", color: "#A855F7", category: "in_progress" });
    expect(duplicateName.status).toBe(409);

    const taskResponse = await owner
      .post(`/api/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Review custom columns", columnId: customColumn.id });
    expect(taskResponse.status).toBe(201);
    const taskId = taskResponse.body.data.id as string;

    const renameResponse = await admin
      .patch(`/api/projects/${projectId}/kanban/columns/${customColumn.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Quality Review", color: "#EC4899" });
    expect(renameResponse.status).toBe(200);
    expect(renameResponse.body.data.id).toBe(customColumn.id);
    expect((await Task.findById(taskId).lean())?.columnId).toBe(customColumn.id);

    const groupedBoard = await member
      .get(`/api/projects/${projectId}/tasks`)
      .query({ groupBy: "column" })
      .set("Authorization", `Bearer ${memberToken}`);
    const reviewGroup = groupedBoard.body.data.columns.find(
      (column: ColumnResponse & { tasks: unknown[] }) => column.id === customColumn.id
    ) as ColumnResponse & { tasks: unknown[] };
    expect(reviewGroup.name).toBe("Quality Review");
    expect(reviewGroup.tasks).toHaveLength(1);

    const allColumnsResponse = await owner
      .get(`/api/projects/${projectId}/kanban/columns`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const allColumns = allColumnsResponse.body.data as ColumnResponse[];
    const reversedIds = [...allColumns].reverse().map((column) => column.id);
    const reorderResponse = await owner
      .put(`/api/projects/${projectId}/kanban/columns/order`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ columnIds: reversedIds });
    expect(reorderResponse.status).toBe(200);
    expect(reorderResponse.body.data.map((column: ColumnResponse) => column.id)).toEqual(reversedIds);

    const incompleteOrder = await owner
      .put(`/api/projects/${projectId}/kanban/columns/order`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ columnIds: [todoColumn.id] });
    expect(incompleteOrder.status).toBe(400);

    const removeFinalTodoCategory = await owner
      .patch(`/api/projects/${projectId}/kanban/columns/${todoColumn.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ category: "in_progress" });
    expect(removeFinalTodoCategory.status).toBe(409);

    const deleteFinalTodo = await owner
      .delete(`/api/projects/${projectId}/kanban/columns/${todoColumn.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(deleteFinalTodo.status).toBe(409);

    const deletePopulatedWithoutDestination = await owner
      .delete(`/api/projects/${projectId}/kanban/columns/${customColumn.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(deletePopulatedWithoutDestination.status).toBe(409);

    const deleteWithDestination = await owner
      .delete(`/api/projects/${projectId}/kanban/columns/${customColumn.id}`)
      .query({ moveTasksToColumnId: inProgressColumn.id })
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(deleteWithDestination.status).toBe(200);
    expect((await Task.findById(taskId).lean())?.columnId).toBe(inProgressColumn.id);
    expect(
      await TaskActivity.exists({ taskId, type: "column_changed", toValue: inProgressColumn.id })
    ).not.toBeNull();

    const outsiderProject = await outsider
      .post("/api/projects")
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ name: "Outsider Workflow" });
    const crossProjectTask = await outsider
      .post(`/api/projects/${outsiderProject.body.data.id as string}/tasks`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ title: "Invalid foreign column", columnId: inProgressColumn.id });
    expect(crossProjectTask.status).toBe(400);

    for (let index = 1; index <= 17; index += 1) {
      const response = await owner
        .post(`/api/projects/${projectId}/kanban/columns`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: `Extra ${index}`, color: "#64748B", category: "in_progress" });
      expect(response.status).toBe(201);
    }
    const overLimit = await owner
      .post(`/api/projects/${projectId}/kanban/columns`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Extra Overflow", color: "#64748B", category: "in_progress" });
    expect(overLimit.status).toBe(409);

    const deleteProject = await owner
      .delete(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(deleteProject.status).toBe(200);
    expect(await Task.exists({ projectId })).toBeNull();
    expect(await TaskActivity.exists({ projectId })).toBeNull();
    expect(await Membership.exists({ projectId })).toBeNull();
  }, 30_000);
});
