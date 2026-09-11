import { Notification, type NotificationDocument, type NotificationType } from "../models/Notification.model";
import { ApiError } from "../utils/ApiError";
import type { ListNotificationsQuery } from "../validators/notification.validator";

export interface NotificationResponse {
  id: string;
  userId: string;
  projectId?: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedTaskId?: string;
  relatedMeetingId?: string;
  readAt?: Date;
  createdAt: Date;
}

/** Converts a notification document into the stable client response shape. */
export function serializeNotification(notification: NotificationDocument): NotificationResponse {
  return {
    id: notification._id.toString(),
    userId: notification.userId.toString(),
    ...(notification.projectId ? { projectId: notification.projectId.toString() } : {}),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    ...(notification.relatedTaskId ? { relatedTaskId: notification.relatedTaskId.toString() } : {}),
    ...(notification.relatedMeetingId ? { relatedMeetingId: notification.relatedMeetingId.toString() } : {}),
    ...(notification.readAt ? { readAt: notification.readAt } : {}),
    createdAt: notification.createdAt,
  };
}

/** Lists only notifications owned by the authenticated user. */
export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery,
): Promise<NotificationResponse[]> {
  const filter: Record<string, unknown> = { userId };
  if (query.projectId) filter.projectId = query.projectId;
  if (query.unreadOnly) filter.readAt = { $exists: false };

  return (await Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(query.limit)).map(
    serializeNotification,
  );
}

/** Marks one owned notification read or unread without exposing other users' records. */
export async function setNotificationRead(
  userId: string,
  notificationId: string,
  read: boolean,
): Promise<NotificationResponse> {
  const update = read ? { $set: { readAt: new Date() } } : { $unset: { readAt: 1 } };
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    update,
    { returnDocument: "after" },
  );
  if (!notification) throw new ApiError(404, "NOT_FOUND", "Notification was not found.");
  return serializeNotification(notification);
}

/** Marks all currently unread notifications for a user as read. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await Notification.updateMany(
    { userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
}
