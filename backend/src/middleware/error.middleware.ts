import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";

/** Converts unmatched routes into Relay's standard NOT_FOUND error. */
export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", `Route ${request.method} ${request.originalUrl} was not found.`));
};

/** Maps trusted operational errors and common database failures to safe public responses. */
export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    const fields = Object.fromEntries(
      error.issues.map((issue) => [issue.path.join("."), issue.message])
    );

    response.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "The request contains invalid data.",
        fields
      }
    });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {})
      }
    });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    response.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "A resource ID is invalid." }
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11_000
  ) {
    response.status(409).json({
      success: false,
      error: { code: "CONFLICT", message: "A record with this value already exists." }
    });
    return;
  }

  // Pino's `err` serializer preserves the useful message, stack, and error code.
  logger.error({ err: error }, "Unhandled request error");
  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred."
    }
  });
};
