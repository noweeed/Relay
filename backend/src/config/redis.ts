import { createClient } from "redis";
import { env } from "./env";
import { logger } from "./logger";

export type RelayRedisClient = ReturnType<typeof createClient>;

let redisClient: RelayRedisClient | undefined;

/** Creates one shared Redis connection without connecting during module import. */
export function getRedisClient(): RelayRedisClient {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is required before the AI transport can be used.");
  }

  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });
    redisClient.on("error", (error: unknown) => {
      logger.error({ err: error }, "Redis client error");
    });
  }

  return redisClient;
}

/** Opens Redis only when an AI transport operation first needs it. */
export async function connectRedis(): Promise<RelayRedisClient> {
  const client = getRedisClient();
  if (!client.isOpen) await client.connect();
  return client;
}

/** Closes the shared Redis socket during graceful shutdown. */
export async function disconnectRedis(): Promise<void> {
  if (redisClient?.isOpen) await redisClient.quit();
}
