import type { RequestHandler } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

const trustedOrigin = new URL(env.FRONTEND_URL).origin;

/** Rejects cross-site browser mutations while allowing non-browser API clients. */
export const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get("origin");
  if (origin && origin !== trustedOrigin) {
    next(new ApiError(403, "FORBIDDEN", "This request origin is not allowed."));
    return;
  }

  next();
};
