import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  listNotificationsQuerySchema,
  notificationParamsSchema,
  setNotificationReadSchema,
} from "../validators/notification.validator";

export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get(
  "/",
  validateRequest({ query: listNotificationsQuerySchema }),
  asyncHandler(notificationController.listNotifications),
);
notificationRouter.patch(
  "/:notificationId/read",
  validateRequest({ params: notificationParamsSchema, body: setNotificationReadSchema }),
  asyncHandler(notificationController.setNotificationRead),
);
notificationRouter.post("/read-all", asyncHandler(notificationController.markAllNotificationsRead));
