import { describe, expect, it } from "vitest";
import { aiJobEnvelopeSchema, aiResultEnvelopeSchema } from "../../src/contracts/ai.contract";

describe("AI transport contracts", () => {
  it("accepts the same v1 job shape used by the Python worker", () => {
    const parsed = aiJobEnvelopeSchema.parse({
      jobId: "job-1",
      jobType: "meeting.process",
      schemaVersion: 1,
      projectId: "project-1",
      initiatingUserId: "user-1",
      createdAt: new Date().toISOString(),
      payload: { meetingId: "meeting-1" }
    });

    expect(parsed.jobId).toBe("job-1");
  });

  it("rejects a failed result that has no structured error", () => {
    const parsed = aiResultEnvelopeSchema.safeParse({
      jobId: "job-1",
      jobType: "meeting.process",
      schemaVersion: 1,
      projectId: "project-1",
      status: "failed",
      completedAt: new Date().toISOString()
    });

    expect(parsed.success).toBe(false);
  });
});
