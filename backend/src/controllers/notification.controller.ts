import type { Request, Response } from "express";
import * as notificationService from "../services/notification.service";
import { ApiError } from "../utils/ApiError";
import type { ListNotificationsQuery } from "../validators/notification.validator";

function getUserId(request: Request): string {
  if (!request.user) throw new ApiError(500, "INTERNAL_ERROR", "Authentication context is missing.");
  return request.user.id;
}

export async function listNotifications(request: Request, response: Response): Promise<void> {
  const notifications = await notificationService.listNotifications(
    getUserId(request),
    request.query as unknown as ListNotificationsQuery,
  );
  response.json({ success: true, data: notifications });
}

export async function setNotificationRead(request: Request, response: Response): Promise<void> {
  const notificationId = request.params.notificationId;
  if (typeof notificationId !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid notification ID is required.");
  }
  const notification = await notificationService.setNotificationRead(
    getUserId(request),
    notificationId,
    (request.body as { read: boolean }).read,
  );
  response.json({ success: true, data: notification });
}

export async function markAllNotificationsRead(request: Request, response: Response): Promise<void> {
  const updated = await notificationService.markAllNotificationsRead(getUserId(request));
  response.json({ success: true, data: { updated } });
}
