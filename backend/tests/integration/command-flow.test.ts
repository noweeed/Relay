import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiJobLedger } from "../../src/models/AiJobLedger.model";
import { CommandLog } from "../../src/models/CommandLog.model";
import { Membership } from "../../src/models/Membership.model";
import { Project } from "../../src/models/Project.model";
import { Task } from "../../src/models/Task.model";
import { TaskActivity } from "../../src/models/TaskActivity.model";
import { User } from "../../src/models/User.model";
import { confirmCommand, cancelCommand } from "../../src/services/command.service";
import { persistAiResult } from "../../src/services/ai-result-persistence.service";

describe("natural-language command lifecycle", () => {
  let database: MongoMemoryReplSet;
  let userId: string;
  let projectId: string;
  let taskId: string;
  let todoColumnId: string;
  let doneColumnId: string;

  beforeAll(async () => {
    database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(database.getUri());
    await Promise.all([
      User.init(), Project.init(), Membership.init(), Task.init(), TaskActivity.init(),
      CommandLog.init(), AiJobLedger.init(),
    ]);
    const user = await User.create({
      name: "Command Owner",
      email: "command-owner@example.com",
      passwordHash: "not-used",
      hasPassword: true,
    });
    const project = await Project.create({ name: "Command Project", createdBy: user._id });
    await Membership.create({ projectId: project._id, userId: user._id, role: "owner" });
    userId = user._id.toString();
    projectId = project._id.toString();
    todoColumnId = project.kanbanColumns.find((column) => column.category === "todo")!.id;
    doneColumnId = project.kanbanColumns.find((column) => column.category === "done")!.id;
    const task = await Task.create({
      projectId,
      title: "Finalize authentication flow",
      dueDate: new Date("2020-01-01T00:00:00.000Z"),
      priority: "high",
      columnId: todoColumnId,
      createdBy: userId,
    });
    taskId = task._id.toString();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await database.stop();
  });

  it("stores a preview and changes a task only after one confirmation", async () => {
    const command = await CommandLog.create({
      projectId, userId, text: "Move authentication to done", status: "processing", activeAiJobId: "move-job",
    });
    const outcome = await persistAiResult({
      jobId: "move-job",
      jobType: "command.interpret",
      schemaVersion: 1,
      projectId,
      resourceId: command._id.toString(),
      status: "succeeded",
      completedAt: new Date().toISOString(),
      payload: {
        commandId: command._id.toString(), status: "resolved", intent: "update_task_status",
        taskId, targetColumnId: doneColumnId, requiresConfirmation: true,
        preview: "Move authentication to Done?", candidateMatches: [],
      },
    });
    expect(outcome).toBe("persisted");
    expect((await CommandLog.findById(command._id))?.status).toBe("awaiting_confirmation");
    expect((await Task.findById(taskId))?.columnId).toBe(todoColumnId);

    const confirmed = await confirmCommand(projectId, userId, command._id.toString());
    expect(confirmed.status).toBe("completed");
    expect((await Task.findById(taskId))?.columnId).toBe(doneColumnId);
    expect(await TaskActivity.exists({ taskId, type: "column_changed" })).not.toBeNull();
    await expect(confirmCommand(projectId, userId, command._id.toString())).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("executes read-only queries in Node and cancellation prevents mutation", async () => {
    await Task.updateOne({ _id: taskId }, { $set: { columnId: todoColumnId } });
    const query = await CommandLog.create({
      projectId, userId, text: "What tasks are overdue?", status: "processing", activeAiJobId: "query-job",
    });
    await persistAiResult({
      jobId: "query-job", jobType: "command.interpret", schemaVersion: 1, projectId,
      resourceId: query._id.toString(), status: "succeeded", completedAt: new Date().toISOString(),
      payload: {
        commandId: query._id.toString(), status: "resolved", intent: "list_overdue_tasks",
        requiresConfirmation: false, preview: "Show overdue tasks.", candidateMatches: [],
      },
    });
    const completed = await CommandLog.findById(query._id).lean();
    expect(completed?.status).toBe("completed");
    expect(completed?.result).toMatchObject({ count: 1 });

    const cancelled = await CommandLog.create({
      projectId, userId, text: "Move authentication to done", status: "awaiting_confirmation",
      intent: "update_task_status", parameters: { taskId, targetColumnId: doneColumnId },
    });
    expect((await cancelCommand(projectId, userId, cancelled._id.toString())).status).toBe("cancelled");
    expect((await Task.findById(taskId))?.columnId).toBe(todoColumnId);
  });

  it("applies a combined status and assignee command atomically", async () => {
    await Task.updateOne(
      { _id: taskId },
      { $set: { columnId: todoColumnId, assigneeIds: [] } },
    );
    const command = await CommandLog.create({
      projectId,
      userId,
      text: "Move authentication to done and add assignee Command Owner",
      status: "processing",
      activeAiJobId: "compound-job",
    });
    const outcome = await persistAiResult({
      jobId: "compound-job",
      jobType: "command.interpret",
      schemaVersion: 1,
      projectId,
      resourceId: command._id.toString(),
      status: "succeeded",
      completedAt: new Date().toISOString(),
      payload: {
        commandId: command._id.toString(),
        status: "resolved",
        intent: "update_task_status",
        taskId,
        targetColumnId: doneColumnId,
        targetAssigneeId: userId,
        requiresConfirmation: true,
        preview: "Move authentication to Done and assign it to Command Owner?",
        candidateMatches: [],
      },
    });

    expect(outcome).toBe("persisted");
    const confirmed = await confirmCommand(projectId, userId, command._id.toString());
    const task = await Task.findById(taskId).lean();
    expect(confirmed.status).toBe("completed");
    expect(task?.columnId).toBe(doneColumnId);
    expect(task?.assigneeIds.map(String)).toEqual([userId]);
  });

  it("recovers an old command left in executing state", async () => {
    await Task.updateOne({ _id: taskId }, { $set: { columnId: todoColumnId } });
    const command = await CommandLog.create({
      projectId,
      userId,
      text: "Move authentication to done",
      status: "executing",
      intent: "update_task_status",
      parameters: { taskId, targetColumnId: doneColumnId },
    });

    const recovered = await confirmCommand(projectId, userId, command._id.toString());

    expect(recovered.status).toBe("completed");
    expect((await Task.findById(taskId))?.columnId).toBe(doneColumnId);
  });
});
