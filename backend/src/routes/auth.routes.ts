import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authRateLimit } from "../middleware/rate-limit.middleware";
import { validateRequest } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { loginSchema, signupSchema } from "../validators/auth.validator";

export const authRouter = Router();

authRouter.post("/signup", authRateLimit, validateRequest({ body: signupSchema }), asyncHandler(authController.signup));
authRouter.post("/login", authRateLimit, validateRequest({ body: loginSchema }), asyncHandler(authController.login));
authRouter.post("/refresh", authRateLimit, asyncHandler(authController.refresh));
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.get("/me", authenticate, asyncHandler(authController.me));
