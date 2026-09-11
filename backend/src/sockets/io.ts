import type { Server as HttpServer } from "node:http";
import mongoose from "mongoose";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { Meeting } from "../models/Meeting.model";
import { Membership } from "../models/Membership.model";
import { verifyAccessToken } from "../utils/tokens";

let io: SocketServer | undefined;

/** Attaches a Socket.IO instance to the HTTP server and installs project-room join/leave. */
export function initializeSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
    // Disable serving the Socket.IO client bundle because the web app installs its own client.
    serveClient: false
  });

  io.use((socket, next) => {
    const authToken = socket.handshake.auth.token;
    const authorization = socket.handshake.headers.authorization;
    const token =
      typeof authToken === "string"
        ? authToken
        : typeof authorization === "string" && authorization.startsWith("Bearer ")
          ? authorization.slice(7)
          : undefined;
    if (!token) return next(new Error("UNAUTHORIZED"));

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.tokenExpiresAt = payload.exp ? payload.exp * 1_000 : Date.now();
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");
    // Every authenticated socket gets a private room for user-owned events.
    void socket.join(`user:${socket.data.userId}`);
    const expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, Math.min(socket.data.tokenExpiresAt - Date.now(), 2_147_483_647)),
    );

    /** Allows an authenticated client to join a project room for scoped events. */
    socket.on("project:join", async (projectId: string) => {
      if (typeof projectId !== "string" || !mongoose.isValidObjectId(projectId)) return;
      const membership = await Membership.exists({ projectId, userId: socket.data.userId });
      if (!membership) return;
      await socket.join(`project:${projectId}`);
      logger.debug({ socketId: socket.id, projectId }, "Socket joined project room");
    });

    /** Allows an authenticated client to leave a project room. */
    socket.on("project:leave", (projectId: string) => {
      if (typeof projectId !== "string" || projectId.length === 0) return;
      void socket.leave(`project:${projectId}`);
      logger.debug({ socketId: socket.id, projectId }, "Socket left project room");
    });

    socket.on("meeting:join", async (meetingId: string) => {
      if (typeof meetingId !== "string" || !mongoose.isValidObjectId(meetingId)) return;
      const meeting = await Meeting.findById(meetingId).select({ projectId: 1 }).lean();
      if (!meeting) return;
      const projectId = meeting.projectId.toString();
      const membership = await Membership.exists({ projectId, userId: socket.data.userId });
      if (!membership) return;
      await socket.join(`meeting:${meetingId}`);
      logger.debug({ socketId: socket.id, meetingId }, "Socket joined meeting room");
    });

    socket.on("meeting:leave", (meetingId: string) => {
      if (typeof meetingId !== "string" || meetingId.length === 0) return;
      void socket.leave(`meeting:${meetingId}`);
    });

    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
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

/** Removes one user's live access to a project and all meetings in that project. */
export async function revokeProjectSocketAccess(projectId: string, userId: string): Promise<void> {
  if (!io) return;
  const meetings = await Meeting.find({ projectId }).select({ _id: 1 }).lean();
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  await Promise.all(
    sockets.map(async (socket) => {
      await socket.leave(`project:${projectId}`);
      await Promise.all(meetings.map((meeting) => socket.leave(`meeting:${meeting._id.toString()}`)));
    }),
  );
}

/** Disconnects every live socket owned by a deleted account. */
export async function disconnectUserSockets(userId: string): Promise<void> {
  if (!io) return;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  await Promise.all(sockets.map(async (socket) => socket.disconnect(true)));
}
