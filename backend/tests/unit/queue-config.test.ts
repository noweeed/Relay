import { describe, expect, it } from "vitest";
import { NOTIFICATION_QUEUE_NAME } from "../../src/jobs/queues";

describe("BullMQ queue configuration", () => {
  it("uses a queue name that does not contain BullMQ's reserved separator", () => {
    expect(NOTIFICATION_QUEUE_NAME).not.toContain(":");
  });
});
