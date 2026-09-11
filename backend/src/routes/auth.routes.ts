import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authRateLimit } from "../middleware/rate-limit.middleware";
import { requireTrustedOrigin } from "../middleware/trusted-origin.middleware";
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
  requireTrustedOrigin,
  authRateLimit,
  validateRequest({ body: signupSchema }),
  asyncHandler(authController.signup),
);
authRouter.post(
  "/login",
  requireTrustedOrigin,
  authRateLimit,
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.login),
);
authRouter.post(
  "/refresh",
  requireTrustedOrigin,
  authRateLimit,
  asyncHandler(authController.refresh),
);
authRouter.post("/logout", requireTrustedOrigin, asyncHandler(authController.logout));
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
  requireTrustedOrigin,
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
  requireTrustedOrigin,
  authRateLimit,
  validateRequest({ body: deleteAccountSchema }),
  asyncHandler(authController.deleteAccount),
);
authRouter.post(
  "/google",
  requireTrustedOrigin,
  authRateLimit,
  validateRequest({ body: googleAuthenticationSchema }),
  asyncHandler(authController.googleAuthentication),
);
