import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

describe("authentication API boundary", () => {
  const app = createApp();

  it("rejects an invalid signup body before database work begins", async () => {
    const response = await request(app).post("/api/auth/signup").send({
      name: "A",
      email: "not-an-email",
      password: "short"
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toHaveProperty("email");
    expect(response.body.error.fields).toHaveProperty("password");
  });

  it("requires a refresh cookie at the refresh endpoint", async () => {
    const response = await request(app).post("/api/auth/refresh");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("protects project endpoints with bearer authentication", async () => {
    const response = await request(app).get("/api/projects");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
