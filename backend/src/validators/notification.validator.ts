import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Enter a valid resource ID.");

export const notificationParamsSchema = z.object({ notificationId: objectId });

export const listNotificationsQuerySchema = z.object({
  projectId: objectId.optional(),
  unreadOnly: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const setNotificationReadSchema = z.object({ read: z.boolean().default(true) });

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
