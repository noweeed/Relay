import { hostname } from "node:os";
import { env } from "../config/env";
import { logger } from "../config/logger";
import {
  acknowledgeAiResult,
  claimStaleAiResults,
  ensureAiResultConsumerGroup,
  parseAiResultEntry,
  publishAiDeadLetter,
  readAiResultGroup,
  type AiResultDelivery
} from "./ai-transport.service";
import { persistAiResult } from "./ai-result-persistence.service";

let stopRequested = false;
let consumerPromise: Promise<void> | undefined;

/** Waits briefly after a consumer failure so a broken dependency cannot create a hot loop. */
function retryDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const consumerName = env.AI_RESULT_CONSUMER_NAME ?? `${hostname()}-${process.pid}`;

async function consumeDelivery(delivery: AiResultDelivery): Promise<void> {
  let entry: ReturnType<typeof parseAiResultEntry>;
  try {
    entry = parseAiResultEntry(delivery.streamId, delivery.fields);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown AI result error";
    await publishAiDeadLetter(
      env.AI_RESULT_STREAM,
      delivery.streamId,
      message,
      delivery.fields.envelope
    );
    await acknowledgeAiResult(delivery.streamId);
    logger.error({ err: error, streamId: delivery.streamId }, "AI result moved to dead-letter stream");
    return;
  }

  // Persistence failures stay pending so this or another API process can reclaim them.
  const outcome = await persistAiResult(entry.result);
  await acknowledgeAiResult(delivery.streamId);
  logger.info(
    { jobId: entry.result.jobId, streamId: delivery.streamId, outcome },
    "AI result consumed"
  );
}

/** Reads durable Redis deliveries, recovers abandoned work, and acknowledges committed results. */
async function consumeAiResults(): Promise<void> {
  await ensureAiResultConsumerGroup();
  let claimCursor = "0-0";
  let retryAttempt = 0;
  while (!stopRequested) {
    try {
      const claimed = await claimStaleAiResults(consumerName, claimCursor);
      claimCursor = claimed.nextId === "0-0" ? "0-0" : claimed.nextId;
      const deliveries =
        claimed.deliveries.length > 0
          ? claimed.deliveries
          : await readAiResultGroup(consumerName, { blockMs: 2_000, count: 10 });
      for (const delivery of deliveries) {
        await consumeDelivery(delivery);
      }
      retryAttempt = 0;
    } catch (error: unknown) {
      const delay = Math.min(
        env.AI_CONSUMER_RETRY_BASE_MS * 2 ** Math.min(retryAttempt, 8),
        env.AI_CONSUMER_RETRY_MAX_MS
      );
      retryAttempt += 1;
      logger.error({ err: error, delay }, "AI result consumer failed; retrying");
      await retryDelay(delay);
    }
  }
}

/** Starts the optional Node-side result consumer without delaying HTTP startup. */
export function startAiResultConsumer(): void {
  if (!env.REDIS_URL || consumerPromise) return;
  stopRequested = false;
  consumerPromise = consumeAiResults().finally(() => {
    consumerPromise = undefined;
  });
}

/** Requests a graceful stop and waits for the current blocking Redis read to finish. */
export async function stopAiResultConsumer(): Promise<void> {
  stopRequested = true;
  await consumerPromise;
}
