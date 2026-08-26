import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireProjectRole } from "../../src/middleware/project-access.middleware";
import { ApiError } from "../../src/utils/ApiError";

/** Creates only the request fields needed to teach and test role authorization. */
function requestWithRole(role: "owner" | "admin" | "member"): Request {
  return {
    projectMembership: { projectId: "507f1f77bcf86cd799439011", role }
  } as Request;
}

describe("project role middleware", () => {
  it("allows a configured project role", () => {
    const next = vi.fn() as unknown as NextFunction;
    requireProjectRole("owner", "admin")(
      requestWithRole("admin"),
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it("returns FORBIDDEN for a role outside the allowed set", () => {
    const next = vi.fn() as unknown as NextFunction;
    requireProjectRole("owner")(requestWithRole("member"), {} as Response, next);

    const error = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("FORBIDDEN");
  });
});
