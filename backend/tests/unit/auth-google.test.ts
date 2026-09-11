import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.hoisted(() => vi.fn());

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    public readonly verifyIdToken = verifyIdToken;
  },
}));

describe("Google authentication", () => {
  it("returns 401 when Google rejects the supplied credential", async () => {
    process.env.GOOGLE_CLIENT_ID = "relay-test.apps.googleusercontent.com";
    verifyIdToken.mockRejectedValueOnce(new Error("Wrong number of segments in token"));
    const { createApp } = await import("../../src/app");

    const response = await request(createApp())
      .post("/api/auth/google")
      .set("origin", "http://localhost:3000")
      .send({ credential: "not-a-google-id-token" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Google could not verify this account.",
      },
    });
  });

  it("returns 401 when the verified payload is incomplete", async () => {
    process.env.GOOGLE_CLIENT_ID = "relay-test.apps.googleusercontent.com";
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: "google-user-id",
        email: "person@example.com",
        email_verified: false,
      }),
    });
    const { createApp } = await import("../../src/app");

    const response = await request(createApp())
      .post("/api/auth/google")
      .set("origin", "http://localhost:3000")
      .send({ credential: "unverified-google-id-token" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
