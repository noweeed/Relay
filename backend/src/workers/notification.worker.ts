import { Worker } from "bullmq";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { getBullMqConnection, NOTIFICATION_QUEUE_NAME } from "../jobs/queues";
import { runDeadlineMonitor } from "../services/deadline-monitor.service";

let notificationWorker: Worker | undefined;

/** Starts the Node-owned worker that performs deterministic deadline checks. */
export function startNotificationWorker(): void {
  if (!env.REDIS_URL || !env.DEADLINE_MONITOR_ENABLED || notificationWorker) return;
  notificationWorker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      if (job.name !== "deadline-monitor") return;
      const result = await runDeadlineMonitor({ upcomingHours: env.DEADLINE_UPCOMING_HOURS });
      logger.info({ jobId: job.id, ...result }, "Deadline monitor completed");
      return result;
    },
    { connection: getBullMqConnection(), concurrency: 1 },
  );
  notificationWorker.on("failed", (job, error) => {
    logger.error({ err: error, jobId: job?.id }, "Deadline monitor failed");
  });
}

export async function stopNotificationWorker(): Promise<void> {
  await notificationWorker?.close();
  notificationWorker = undefined;
}
