import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { Membership } from "../../src/models/Membership.model";
import { Notification } from "../../src/models/Notification.model";
import { Project } from "../../src/models/Project.model";
import { RefreshSession } from "../../src/models/RefreshSession.model";
import { Task } from "../../src/models/Task.model";
import { User } from "../../src/models/User.model";
import { runDeadlineMonitor } from "../../src/services/deadline-monitor.service";

describe("notification and deadline monitoring", () => {
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
      Notification.init(),
    ]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("creates upcoming/overdue notifications once and exposes owned read endpoints", async () => {
    const owner = request.agent(app);
    const signup = await owner.post("/api/auth/signup").send({
      name: "Deadline Owner",
      email: "deadline-owner@example.com",
      password: "deadline-owner-secure-password",
    });
    const userId = signup.body.data.user.id as string;
    const token = signup.body.data.accessToken as string;

    const projectResponse = await owner
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Deadline Project" });
    const projectId = projectResponse.body.data.id as string;
    const columns = projectResponse.body.data.kanbanColumns as Array<{
      id: string;
      category: string;
    }>;
    const todoColumnId = columns.find((column) => column.category === "todo")!.id;
    const doneColumnId = columns.find((column) => column.category === "done")!.id;
    const now = new Date("2026-09-04T12:00:00.000Z");

    await Task.create([
      {
        projectId,
        title: "Upcoming task",
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
        priority: "medium",
        columnId: todoColumnId,
        createdBy: userId,
      },
      {
        projectId,
        title: "Overdue task",
        dueDate: new Date("2026-09-04T11:00:00.000Z"),
        priority: "high",
        columnId: todoColumnId,
        createdBy: userId,
      },
      {
        projectId,
        title: "Completed task",
        dueDate: new Date("2026-09-01T00:00:00.000Z"),
        priority: "low",
        columnId: doneColumnId,
        createdBy: userId,
      },
    ]);

    const firstRun = await runDeadlineMonitor({ now, upcomingHours: 24 });
    expect(firstRun).toMatchObject({ scanned: 2, created: 2, deduplicated: 0 });
    const secondRun = await runDeadlineMonitor({ now, upcomingHours: 24 });
    expect(secondRun).toMatchObject({ scanned: 2, created: 0, deduplicated: 2 });
    expect(await Notification.countDocuments()).toBe(2);

    const list = await owner
      .get("/api/notifications")
      .query({ unreadOnly: "true" })
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data.map((entry: { type: string }) => entry.type).sort()).toEqual([
      "deadline_upcoming",
      "task_overdue",
    ]);
    expect(list.body.data.map((entry: { body: string }) => entry.body)).toEqual(
      expect.arrayContaining([
        "“Upcoming task” is due Sep 5, 2026.",
        "“Overdue task” was due Sep 4, 2026.",
      ]),
    );

    const notificationId = list.body.data[0].id as string;
    const markOne = await owner
      .patch(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${token}`)
      .send({ read: true });
    expect(markOne.status).toBe(200);
    expect(markOne.body.data.readAt).toBeTruthy();

    const markAll = await owner
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);
    expect(markAll.status).toBe(200);
    expect(markAll.body.data.updated).toBe(1);
  });

  it("honors recipient preferences", async () => {
    const user = await User.create({
      name: "Quiet User",
      email: "quiet@example.com",
      passwordHash: "not-used",
      hasPassword: true,
      notificationPreferences: {
        upcomingDeadlines: false,
        overdueTasks: false,
        meetingProcessing: false,
        reviewQueue: false,
        mentionsAndAssignments: false,
        weeklyDigest: false,
        emailNotifications: false,
        inAppNotifications: false,
      },
    });
    const project = await Project.create({ name: "Quiet Project", createdBy: user._id });
    await Membership.create({ projectId: project._id, userId: user._id, role: "owner" });
    const todoColumnId = project.kanbanColumns.find((column) => column.category === "todo")!.id;
    await Task.create({
      projectId: project._id,
      title: "Silent overdue task",
      dueDate: new Date("2026-09-03T00:00:00.000Z"),
      priority: "medium",
      columnId: todoColumnId,
      createdBy: user._id,
    });

    const result = await runDeadlineMonitor({ now: new Date("2026-09-04T12:00:00.000Z") });
    expect(result.skippedByPreference).toBeGreaterThanOrEqual(1);
    expect(await Notification.exists({ userId: user._id })).toBeNull();
  });

  it("does not notify a user after project membership is removed", async () => {
    const user = await User.create({
      name: "Former Member",
      email: "former-member@example.com",
      passwordHash: "not-used",
      hasPassword: true,
    });
    const owner = await User.create({
      name: "Owner",
      email: "notification-owner@example.com",
      passwordHash: "not-used",
      hasPassword: true,
    });
    const project = await Project.create({ name: "Private Project", createdBy: owner._id });
    const todoColumnId = project.kanbanColumns.find((column) => column.category === "todo")!.id;
    await Task.create({
      projectId: project._id,
      title: "Private deadline",
      dueDate: new Date("2026-09-05T00:00:00.000Z"),
      priority: "high",
      columnId: todoColumnId,
      assigneeId: user._id,
      createdBy: owner._id,
    });

    await runDeadlineMonitor({ now: new Date("2026-09-04T12:00:00.000Z") });

    expect(await Notification.exists({ userId: user._id, projectId: project._id })).toBeNull();
  });
});
