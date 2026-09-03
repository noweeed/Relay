import type mongoose from "mongoose";
import {
  type MeetingDocument,
  type MeetingStatus
} from "../models/Meeting.model";

const VALID_TRANSITIONS: Record<MeetingStatus, readonly MeetingStatus[]> = {
  created: ["processing"],
  processing: ["ready_for_review", "failed"],
  ready_for_review: ["completed"],
  completed: [],
  failed: ["created"]
};

/** Enforces the same meeting state machine for HTTP requests and background workers. */
export async function transitionMeetingStatus(
  meeting: MeetingDocument,
  target: MeetingStatus,
  options: { errorMessage?: string; session?: mongoose.ClientSession } = {}
): Promise<void> {
  if (!VALID_TRANSITIONS[meeting.status].includes(target)) {
    throw new Error(`Cannot transition from "${meeting.status}" to "${target}".`);
  }

  meeting.status = target;
  meeting.errorMessage = target === "failed" ? options.errorMessage : undefined;
  await meeting.save({ ...(options.session ? { session: options.session } : {}) });
}

export function canTransitionMeetingStatus(from: MeetingStatus, to: MeetingStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
