import { io, type Socket } from "socket.io-client";

export type MeetingProgressEvent = {
  meetingId: string;
  projectId: string;
  status: "created" | "processing" | "ready_for_review" | "completed" | "failed";
  errorMessage?: string;
};

const socketUrl = (
  import.meta.env["VITE_SOCKET_URL"] ??
  (import.meta.env["VITE_API_URL"] ?? "http://localhost:5000/api").replace(/\/api\/?$/, "")
).replace(/\/$/, "");

/** Opens an authenticated realtime connection without persisting the access token. */
export function createRelaySocket(token: string): Socket {
  return io(socketUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
}
