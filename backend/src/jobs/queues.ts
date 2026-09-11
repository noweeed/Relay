import type { ConnectionOptions } from "bullmq";
import { env } from "../config/env";

// BullMQ reserves colons for its own Redis key separator.
export const NOTIFICATION_QUEUE_NAME = "relay-notifications";

/** Converts the configured Redis URL into BullMQ/ioredis connection options. */
export function getBullMqConnection(): ConnectionOptions {
  if (!env.REDIS_URL) throw new Error("REDIS_URL is required before BullMQ can be started.");
  const url = new URL(env.REDIS_URL);
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(Number.isInteger(database) ? { db: database } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
