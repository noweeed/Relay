import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aiJobEnvelopeSchema,
  aiResultEnvelopeSchema,
  meetingExtractionResultSchema
} from "../../src/contracts/ai.contract";

const fixtureDirectory = resolve(process.cwd(), "ai-service/tests/fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureDirectory, name), "utf8"));
}

describe("shared AI contract fixtures", () => {
  it("accepts the same meeting job and result shapes as the Python worker", () => {
    const job = aiJobEnvelopeSchema.parse(loadFixture("meeting_process_job.json"));
    const result = aiResultEnvelopeSchema.parse(loadFixture("meeting_process_result.json"));

    expect(job.resourceId).toBe("fixture-meeting-1");
    expect(result.status).toBe("succeeded");
    if (result.status === "succeeded") {
      const extraction = meetingExtractionResultSchema.parse(result.payload);
      expect(extraction.tasks[0]?.sourceQuote).toBe(
        "I will finish the candidate review API by Friday."
      );
    }
  });
});
