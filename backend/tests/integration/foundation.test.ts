import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import * as database from "../../src/config/database";

describe("backend foundation", () => {
  const app = createApp();

  it("exposes the API root", async () => {
    const response = await request(app).get("/api");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { name: "Relay API" }
    });
  });

  it("reports degraded health when MongoDB is disconnected", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.data.database.status).toBe("disconnected");
  });

  it("reports healthy when MongoDB is connected", async () => {
    const healthSpy = vi
      .spyOn(database, "getDatabaseHealth")
      .mockReturnValue({ status: "connected", readyState: 1 });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.database.status).toBe("connected");
    healthSpy.mockRestore();
  });

  it("uses the standard error contract for unknown routes", async () => {
    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route GET /missing was not found."
      }
    });
  });
});
