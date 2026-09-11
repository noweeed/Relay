import type { Request, Response } from "express";
import * as commandService from "../services/command.service";
import { ApiError } from "../utils/ApiError";
import type { CreateCommandInput } from "../validators/command.validator";

function context(request: Request): { projectId: string; userId: string; commandId?: string } {
  if (!request.projectMembership || !request.user) {
    throw new ApiError(500, "INTERNAL_ERROR", "Command authorization context is missing.");
  }
  const commandId = request.params.commandId;
  return {
    projectId: request.projectMembership.projectId,
    userId: request.user.id,
    ...(typeof commandId === "string" ? { commandId } : {}),
  };
}

export async function createCommand(request: Request, response: Response): Promise<void> {
  const value = context(request);
  const command = await commandService.createCommand(
    value.projectId,
    value.userId,
    request.body as CreateCommandInput,
  );
  response.status(202).json({ success: true, data: command });
}

export async function getCommand(request: Request, response: Response): Promise<void> {
  const value = context(request);
  const command = await commandService.getCommand(value.projectId, value.userId, value.commandId!);
  response.json({ success: true, data: command });
}

export async function confirmCommand(request: Request, response: Response): Promise<void> {
  const value = context(request);
  const command = await commandService.confirmCommand(value.projectId, value.userId, value.commandId!);
  response.json({ success: true, data: command });
}

export async function cancelCommand(request: Request, response: Response): Promise<void> {
  const value = context(request);
  const command = await commandService.cancelCommand(value.projectId, value.userId, value.commandId!);
  response.json({ success: true, data: command });
}
