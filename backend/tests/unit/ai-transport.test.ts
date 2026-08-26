import { describe, expect, it, vi } from "vitest";
import {
  parseAiResultEntry,
  publishAiJob,
  readAiResultsAfter
} from "../../src/services/ai-transport.service";

describe("AI Redis Streams transport", () => {
  it("publishes a validated JSON job envelope", async () => {
    const xAdd = vi.fn().mockResolvedValue("1710000000000-0");

    const published = await publishAiJob(
      {
        jobId: "job-1",
        jobType: "meeting.process",
        projectId: "project-1",
        initiatingUserId: "user-1",
        resourceId: "meeting-1",
        payload: { meetingId: "meeting-1" }
      },
      { xAdd } as never
    );

    expect(published.streamId).toBe("1710000000000-0");
    expect(xAdd).toHaveBeenCalledWith(
      "relay:ai:jobs",
      "*",
      expect.objectContaining({ envelope: expect.any(String) })
    );
    expect(JSON.parse(xAdd.mock.calls[0]?.[2].envelope as string)).toMatchObject({
      jobId: "job-1",
      schemaVersion: 1,
      resourceId: "meeting-1"
    });
  });

  it("validates result envelopes before returning them to persistence code", () => {
    const entry = parseAiResultEntry("1710000000001-0", {
      envelope: JSON.stringify({
        jobId: "job-1",
        jobType: "meeting.process",
        schemaVersion: 1,
        projectId: "project-1",
        resourceId: "meeting-1",
        status: "succeeded",
        completedAt: new Date().toISOString(),
        payload: { meetingId: "meeting-1", tasks: [] }
      })
    });

    expect(entry.result.status).toBe("succeeded");
  });

  it("rejects malformed Redis result messages", () => {
    expect(() => parseAiResultEntry("bad-1", { envelope: "not-json" })).toThrow(
      "contains invalid JSON"
    );
  });

  it("reads validated results after a stream cursor", async () => {
    const envelope = JSON.stringify({
      jobId: "job-2",
      jobType: "meeting.process",
      schemaVersion: 1,
      projectId: "project-1",
      status: "succeeded",
      completedAt: new Date().toISOString(),
      payload: { meetingId: "meeting-2", tasks: [] }
    });
    const xRead = vi.fn().mockResolvedValue([
      {
        name: "relay:ai:results",
        messages: [{ id: "1710000000002-0", message: { envelope } }]
      }
    ]);

    const results = await readAiResultsAfter("1710000000001-0", { blockMs: 1 }, { xRead } as never);

    expect(results[0]?.result.jobId).toBe("job-2");
    expect(xRead).toHaveBeenCalledWith(
      [{ key: "relay:ai:results", id: "1710000000001-0" }],
      { BLOCK: 1, COUNT: 10 }
    );
  });
});
