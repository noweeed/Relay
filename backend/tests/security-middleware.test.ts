import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/middleware/error.middleware";
import { createRelayRateLimit } from "../src/middleware/rate-limit.middleware";
import { requireTrustedOrigin } from "../src/middleware/trusted-origin.middleware";

describe("security middleware", () => {
  it("limits expensive requests independently per authenticated user", async () => {
    const app = express();
    app.use((incoming, _response, next) => {
      incoming.user = { id: incoming.get("x-test-user") ?? "anonymous" };
      next();
    });
    app.post(
      "/expensive",
      createRelayRateLimit({
        windowMs: 60_000,
        limit: 2,
        message: "Too many AI requests. Try again later.",
        authenticated: true,
      }),
      (_incoming, response) => response.status(204).send(),
    );

    expect((await request(app).post("/expensive").set("x-test-user", "one")).status).toBe(204);
    expect((await request(app).post("/expensive").set("x-test-user", "one")).status).toBe(204);
    const blocked = await request(app).post("/expensive").set("x-test-user", "one");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["ratelimit-policy"]).toBeDefined();
    expect((await request(app).post("/expensive").set("x-test-user", "two")).status).toBe(204);
  });

  it("rejects cross-site browser mutations but allows trusted and API-client requests", async () => {
    const app = express();
    app.post("/mutation", requireTrustedOrigin, (_incoming, response) => response.status(204).send());
    app.use(errorHandler);

    const rejected = await request(app).post("/mutation").set("origin", "https://attacker.example");
    expect(rejected.status).toBe(403);
    expect(rejected.body.error.code).toBe("FORBIDDEN");
    expect((await request(app).post("/mutation").set("origin", "http://localhost:3000")).status).toBe(204);
    expect((await request(app).post("/mutation")).status).toBe(204);
  });
});
