import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

// Use Google Public DNS for MongoDB Atlas SRV record lookups.
dns.setServers(["8.8.8.8"]);

const databaseStates: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting"
};

/** Opens the shared Mongoose connection before the HTTP server accepts traffic. */
export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("MongoDB connection established");
}

/** Closes MongoDB cleanly during tests or graceful process shutdown. */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/** Translates Mongoose's numeric connection state into health-check data. */
export function getDatabaseHealth(): { status: string; readyState: number } {
  const readyState = mongoose.connection.readyState;

  return {
    status: databaseStates[readyState] ?? "unknown",
    readyState
  };
}
