import type { NextFunction, Request, RequestHandler, Response } from "express";
import { User } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/tokens";

/** Authenticates a bearer token and attaches the verified user identity to the request. */
export const authenticate: RequestHandler = async (
  request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = request.header("authorization");
    const [scheme, token] = authorization?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
      throw new ApiError(401, "UNAUTHORIZED", "A valid bearer token is required.");
    }

    const payload = verifyAccessToken(token);
    const userExists = await User.exists({ _id: payload.sub });

    if (!userExists) {
      throw new ApiError(401, "UNAUTHORIZED", "The authenticated user no longer exists.");
    }

    request.user = { id: payload.sub };
    next();
  } catch (error: unknown) {
    next(
      error instanceof ApiError
        ? error
        : new ApiError(401, "UNAUTHORIZED", "The access token is invalid or expired.")
    );
  }
};
