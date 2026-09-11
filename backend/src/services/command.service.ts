import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { Membership } from "../models/Membership.model";
import { CommandLog, type CommandLogDocument } from "../models/CommandLog.model";
import { Project } from "../models/Project.model";
import { Task } from "../models/Task.model";
import { User } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { emitTaskUpdated } from "../sockets/taskEvents";
import type { CreateCommandInput } from "../validators/command.validator";
import { publishAiJob } from "./ai-transport.service";
import { updateTaskInSession, type TaskResponse } from "./task.service";

export interface CommandResponse {
  id: string;
  projectId: string;
  text: string;
  status: CommandLogDocument["status"];
  intent?: CommandLogDocument["intent"];
  parameters?: Record<string, unknown>;
  preview?: string;
  candidateMatches: Array<{ id: string; label: string }>;
  result?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeCommand(command: CommandLogDocument): CommandResponse {
  return {
    id: command._id.toString(),
    projectId: command.projectId.toString(),
    text: command.text,
    status: command.status,
    ...(command.intent ? { intent: command.intent } : {}),
    ...(command.parameters ? { parameters: command.parameters } : {}),
    ...(command.preview ? { preview: command.preview } : {}),
    candidateMatches: command.candidateMatches.map((match) => ({ id: match.id, label: match.label })),
    ...(command.result ? { result: command.result } : {}),
    ...(command.errorMessage ? { errorMessage: command.errorMessage } : {}),
    createdAt: command.createdAt,
    updatedAt: command.updatedAt,
  };
}

/** Stores the audit record and dispatches only project-scoped context to Python. */
export async function createCommand(
  projectId: string,
  userId: string,
  input: CreateCommandInput,
): Promise<CommandResponse> {
  const project = await Project.findById(projectId, { kanbanColumns: 1 }).lean();
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project was not found.");
  const [tasks, memberships] = await Promise.all([
    Task.find({ projectId }).select({ title: 1, columnId: 1, assigneeIds: 1, assigneeId: 1 }).lean(),
    Membership.find({ projectId }).select({ userId: 1 }).lean(),
  ]);
  const users = await User.find(
    { _id: { $in: memberships.map((membership) => membership.userId) } },
    { name: 1 },
  ).lean();
  const jobId = randomUUID();
  const command = await CommandLog.create({
    projectId,
    userId,
    text: input.text,
    status: "processing",
    activeAiJobId: jobId,
  });

  try {
    await publishAiJob({
      jobId,
      jobType: "command.interpret",
      projectId,
      initiatingUserId: userId,
      resourceId: command._id.toString(),
      payload: {
        commandId: command._id.toString(),
        text: input.text,
        tasks: tasks.map((task) => ({
          id: task._id.toString(),
          title: task.title,
          columnId: task.columnId,
          ...((task.assigneeIds?.[0] ?? task.assigneeId)
            ? { assigneeId: (task.assigneeIds?.[0] ?? task.assigneeId)!.toString() }
            : {}),
        })),
        columns: project.kanbanColumns.map(({ id, name, category }) => ({ id, name, category })),
        members: users.map((user) => ({ id: user._id.toString(), name: user.name })),
      },
    });
  } catch {
    command.status = "failed";
    command.activeAiJobId = undefined;
    command.errorMessage = "The command interpreter is temporarily unavailable.";
    await command.save();
    throw new ApiError(503, "SERVICE_UNAVAILABLE", command.errorMessage);
  }
  return serializeCommand(command);
}

export async function getCommand(
  projectId: string,
  userId: string,
  commandId: string,
): Promise<CommandResponse> {
  const command = await CommandLog.findOne({ _id: commandId, projectId, userId });
  if (!command) throw new ApiError(404, "NOT_FOUND", "Command was not found.");
  return serializeCommand(command);
}

/** Cancels a command before any mutation begins. */
export async function cancelCommand(
  projectId: string,
  userId: string,
  commandId: string,
): Promise<CommandResponse> {
  const command = await CommandLog.findOneAndUpdate(
    { _id: commandId, projectId, userId, status: { $in: ["processing", "awaiting_confirmation", "ambiguous"] } },
    { $set: { status: "cancelled", cancelledAt: new Date() }, $unset: { activeAiJobId: 1 } },
    { returnDocument: "after" },
  );
  if (!command) throw new ApiError(409, "CONFLICT", "This command can no longer be cancelled.");
  return serializeCommand(command);
}

/** Claims and executes a previously previewed mutation exactly once. */
export async function confirmCommand(
  projectId: string,
  userId: string,
  commandId: string,
): Promise<CommandResponse> {
  let completed: CommandLogDocument | undefined;
  let updatedTask: TaskResponse | undefined;
  await mongoose.connection.transaction(async (session) => {
    const command = await CommandLog.findOne({
      _id: commandId,
      projectId,
      userId,
      status: { $in: ["awaiting_confirmation", "executing"] },
    }).session(session);
    if (!command) {
      throw new ApiError(409, "CONFLICT", "This command is not awaiting confirmation.");
    }
    const parameters = command.parameters ?? {};
    const taskId = parameters.taskId;
    if (typeof taskId !== "string") throw new Error("Confirmed command has no task target.");
    if (command.intent === "update_task_status") {
      const targetColumnId = parameters.targetColumnId;
      if (typeof targetColumnId !== "string") throw new Error("Confirmed command has no column target.");
      updatedTask = await updateTaskInSession(
        projectId,
        taskId,
        userId,
        {
          columnId: targetColumnId,
          ...(typeof parameters.targetAssigneeId === "string"
            ? { assigneeIds: [parameters.targetAssigneeId] }
            : {}),
        },
        session,
      );
    } else if (command.intent === "assign_task") {
      const targetAssigneeId = parameters.targetAssigneeId;
      if (typeof targetAssigneeId !== "string") throw new Error("Confirmed command has no assignee target.");
      updatedTask = await updateTaskInSession(
        projectId,
        taskId,
        userId,
        { assigneeIds: [targetAssigneeId] },
        session,
      );
    } else {
      throw new Error("Confirmed command intent is not a supported mutation.");
    }
    command.status = "completed";
    command.executedAt = new Date();
    command.result = { executed: true };
    await command.save({ session });
    completed = command;
  });
  if (!completed || !updatedTask) {
    throw new ApiError(500, "INTERNAL_ERROR", "Command execution did not complete.");
  }
  emitTaskUpdated(projectId, updatedTask);
  return serializeCommand(completed);
}
