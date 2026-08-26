import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "../config/logger";

let io: SocketServer | undefined;

/** Attaches a Socket.IO instance to the HTTP server and installs project-room join/leave. */
export function initializeSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
    // Disable serving the Socket.IO client bundle because the web app installs its own client.
    serveClient: false
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");

    /** Allows an authenticated client to join a project room for scoped events. */
    socket.on("project:join", (projectId: string) => {
      if (typeof projectId !== "string" || projectId.length === 0) return;
      void socket.join(`project:${projectId}`);
      logger.debug({ socketId: socket.id, projectId }, "Socket joined project room");
    });

    /** Allows an authenticated client to leave a project room. */
    socket.on("project:leave", (projectId: string) => {
      if (typeof projectId !== "string" || projectId.length === 0) return;
      void socket.leave(`project:${projectId}`);
      logger.debug({ socketId: socket.id, projectId }, "Socket left project room");
    });

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });

  logger.info("Socket.IO server initialized");
  return io;
}

/** Returns the live Socket.IO instance, or undefined before server startup. */
export function getSocketServer(): SocketServer | undefined {
  return io;
}
