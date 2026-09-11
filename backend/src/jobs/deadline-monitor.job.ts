import { Queue } from "bullmq";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { getBullMqConnection, NOTIFICATION_QUEUE_NAME } from "./queues";

let notificationQueue: Queue | undefined;

/** Installs one stable repeat scheduler; repeated startups update instead of duplicating it. */
export async function scheduleDeadlineMonitor(): Promise<void> {
  if (!env.REDIS_URL || !env.DEADLINE_MONITOR_ENABLED) return;
  notificationQueue ??= new Queue(NOTIFICATION_QUEUE_NAME, { connection: getBullMqConnection() });
  await notificationQueue.upsertJobScheduler(
    "deadline-monitor",
    { every: env.DEADLINE_MONITOR_INTERVAL_MS },
    { name: "deadline-monitor", data: {} },
  );
  logger.info({ everyMs: env.DEADLINE_MONITOR_INTERVAL_MS }, "Deadline monitor scheduled");
}

export async function closeDeadlineMonitorQueue(): Promise<void> {
  await notificationQueue?.close();
  notificationQueue = undefined;
}
