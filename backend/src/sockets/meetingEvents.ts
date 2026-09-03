import type { MeetingStatus } from "../models/Meeting.model";
import { getSocketServer } from "./io";

export interface MeetingProgressEvent {
  meetingId: string;
  projectId: string;
  status: MeetingStatus;
  errorMessage?: string;
}

/** Broadcasts one durable meeting status change to both scoped rooms. */
export function emitMeetingProgress(event: MeetingProgressEvent): void {
  const io = getSocketServer();
  if (!io) return;
  io.to(`project:${event.projectId}`).to(`meeting:${event.meetingId}`).emit("meeting.progress", event);
}
