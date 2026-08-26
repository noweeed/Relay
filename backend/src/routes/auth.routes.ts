import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authRateLimit } from "../middleware/rate-limit.middleware";
import { validateRequest } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  changePasswordSchema,
  deleteAccountSchema,
  googleAuthenticationSchema,
  loginSchema,
  notificationPreferencesSchema,
  signupSchema,
  updateProfileSchema,
} from "../validators/auth.validator";

export const authRouter = Router();

authRouter.post(
  "/signup",
  authRateLimit,
  validateRequest({ body: signupSchema }),
  asyncHandler(authController.signup),
);
authRouter.post(
  "/login",
  authRateLimit,
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.login),
);
authRouter.post(
  "/refresh",
  authRateLimit,
  asyncHandler(authController.refresh),
);
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.get("/me", authenticate, asyncHandler(authController.me));
authRouter.patch(
  "/me",
  authenticate,
  validateRequest({ body: updateProfileSchema }),
  asyncHandler(authController.updateProfile),
);
authRouter.patch(
  "/me/password",
  authenticate,
  authRateLimit,
  validateRequest({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword),
);
authRouter.put(
  "/me/notifications",
  authenticate,
  validateRequest({ body: notificationPreferencesSchema }),
  asyncHandler(authController.updateNotificationPreferences),
);
authRouter.delete(
  "/me",
  authenticate,
  authRateLimit,
  validateRequest({ body: deleteAccountSchema }),
  asyncHandler(authController.deleteAccount),
);
authRouter.post(
  "/google",
  authRateLimit,
  validateRequest({ body: googleAuthenticationSchema }),
  asyncHandler(authController.googleAuthentication),
);
