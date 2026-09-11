import { rateLimit } from "express-rate-limit";
import { env } from "../config/env";

type RelayRateLimitOptions = {
  windowMs: number;
  limit: number;
  message: string;
  authenticated?: boolean;
  skipInTests?: boolean;
};

/** Creates a limiter with Relay's stable JSON error envelope. */
export function createRelayRateLimit(options: RelayRateLimitOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: options.authenticated
      ? (request) => `user:${request.user?.id ?? "anonymous"}`
      : undefined,
    skip: () => Boolean(options.skipInTests && env.NODE_ENV === "test"),
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: options.message,
      },
    },
  });
}

/** Limits credential and refresh attempts to reduce online guessing and token abuse. */
export const authRateLimit = createRelayRateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  message: "Too many authentication attempts. Try again later.",
  skipInTests: true,
});

/** Limits costly transcription, extraction, reprocessing, and command requests per user. */
export const expensiveAiRateLimit = createRelayRateLimit({
  windowMs: env.AI_ROUTE_RATE_LIMIT_WINDOW_MS,
  limit: env.AI_ROUTE_RATE_LIMIT_MAX,
  message: "Too many AI requests. Try again later.",
  authenticated: true,
  skipInTests: true,
});
