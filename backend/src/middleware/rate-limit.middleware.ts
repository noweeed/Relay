import { rateLimit } from "express-rate-limit";

/** Limits credential and refresh attempts to reduce online guessing and token abuse. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many authentication attempts. Try again later."
    }
  }
});
