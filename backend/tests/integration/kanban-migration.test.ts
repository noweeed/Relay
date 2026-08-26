import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateKanbanColumns } from "../../src/migrations/kanban-columns.migration";

describe("custom Kanban column migration", () => {
  let database: MongoMemoryReplSet;

  beforeAll(async () => {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(database.getUri());
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("backfills legacy statuses and remains safe when run twice", async () => {
    const projectId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const projects = mongoose.connection.collection("projects");
    const tasks = mongoose.connection.collection("tasks");
    const activities = mongoose.connection.collection("taskactivities");

    await projects.insertOne({
      _id: projectId,
      name: "Legacy Board",
      createdBy: userId,
      createdAt: now,
      updatedAt: now
    });
    await tasks.insertOne({
      _id: taskId,
      projectId,
      title: "Legacy task",
      priority: "medium",
      status: "in_progress",
      createdBy: userId,
      createdAt: now,
      updatedAt: now
    });
    await activities.insertOne({
      projectId,
      taskId,
      actorId: userId,
      actorType: "user",
      type: "status_changed",
      fromValue: "todo",
      toValue: "in_progress",
      createdAt: now
    });

    const firstResult = await migrateKanbanColumns();
    expect(firstResult).toEqual({ projectsSeeded: 1, tasksBackfilled: 1, activitiesConverted: 1 });

    const migratedProject = await projects.findOne({ _id: projectId });
    const columns = migratedProject?.kanbanColumns as Array<{
      id: string;
      category: string;
    }>;
    expect(columns).toHaveLength(3);
    const inProgressColumnId = columns.find((column) => column.category === "in_progress")!.id;

    const migratedTask = await tasks.findOne({ _id: taskId });
    expect(migratedTask?.columnId).toBe(inProgressColumnId);
    expect(migratedTask?.status).toBeUndefined();
    expect((await activities.findOne({ taskId }))?.type).toBe("column_changed");

    const secondResult = await migrateKanbanColumns();
    expect(secondResult).toEqual({ projectsSeeded: 0, tasksBackfilled: 0, activitiesConverted: 0 });
    expect((await projects.findOne({ _id: projectId }))?.kanbanColumns).toEqual(columns);
  });
});
