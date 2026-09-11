import type { NotificationResponse } from "../services/notification.service";
import { getSocketServer } from "./io";

/** Sends a private notification event only to sockets owned by its recipient. */
export function emitNotificationCreated(userId: string, notification: NotificationResponse): void {
  getSocketServer()?.to(`user:${userId}`).emit("notification.created", notification);
}
