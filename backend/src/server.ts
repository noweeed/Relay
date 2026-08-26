import { createServer } from "node:http";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { initializeSocketServer } from "./sockets/io";

/** Connects required infrastructure, starts HTTP traffic, and installs graceful shutdown hooks. */
async function startServer(): Promise<void> {
  await connectDatabase();

  const server = createServer(createApp());
  initializeSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Relay API is listening");
  });

  /** Stops accepting traffic before closing MongoDB and exiting the process. */
  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, "Graceful shutdown started");
    server.close(() => {
      void disconnectDatabase()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          // Pino recognizes `err` and serializes its message, stack, and error code.
          logger.error({ err: error }, "Database disconnect failed");
          process.exit(1);
        });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch((error: unknown) => {
  // Use Pino's standard `err` field so startup failures are never logged as `{}`.
  logger.fatal({ err: error }, "Relay API failed to start");
  process.exit(1);
});
