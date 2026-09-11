export type Priority = "high" | "medium" | "low";
export type Status = "todo" | "in_progress" | "done";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  accessRole?: "owner" | "admin" | "member";
};

export type ActivityEntry = {
  id: string;
  text: string;
  at: string;
  actorName?: string;
};

export type TaskComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type DashboardActivity = ActivityEntry & { actorId?: string };

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeIds?: string[];
  /** Legacy API compatibility; new task responses use assigneeIds. */
  assigneeId?: string | null;
  due: string | null;
  priority: Priority;
  status: Status;
  columnId?: string;
  assigneeNames?: string[];
  assigneeName?: string;
  sourceMeetingId?: string;
  sourceSegmentId?: string;
  sourceTimestamp?: string;
  sourceQuote?: string;
  activity: ActivityEntry[];
};

export type TranscriptSegment = {
  id: string;
  time: string;
  speakerId?: string;
  speakerName?: string;
  text: string;
  taskId?: string;
};

export type Meeting = {
  id: string;
  projectId: string;
  title: string;
  date: string;
  durationMin: number;
  participantIds: string[];
  status:
    | "created"
    | "processing"
    | "ready_for_review"
    | "completed"
    | "failed"
    | "reviewed"
    | "needs_review";
  transcript: TranscriptSegment[];
  type?: "transcript" | "audio";
  segmentCount?: number;
  errorMessage?: string;
  createdBy?: string;
};

export type Candidate = {
  id: string;
  meetingId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  due: string | null;
  priority: Priority;
  timestamp: string;
  quote: string;
  state: "pending" | "approved" | "rejected" | "duplicate_pending";
  createdTaskId?: string;
  duplicateOf?: {
    id: string;
    taskId: string;
    confidence: "high" | "medium";
    existingDue: string | null;
    differences?: Record<string, { existing?: unknown; candidate?: unknown }>;
  };
};

export type KanbanColumn = {
  id: string;
  name: string;
  color: string;
  category: Status;
  order: number;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  kanbanColumns?: KanbanColumn[];
  role?: "owner" | "admin" | "member";
};

export type Notification = {
  id: string;
  kind: "deadline" | "overdue" | "review";
  title: string;
  body: string;
  at: string;
  read: boolean;
};

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function formatDate(iso: string | null) {
  if (!iso) return "No date";
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatLongDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isOverdue(task: Task, now = new Date()) {
  if (!task.due || task.status === "done") return false;
  return new Date(`${task.due}T23:59:59.999Z`) < now;
}

export function dueThisWeek(task: Task, now = new Date()) {
  if (!task.due || task.status === "done") return false;
  const due = new Date(`${task.due}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return due >= today && due < today + 7 * 86_400_000;
}

export const statusLabel: Record<Status, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

export const priorityLabel: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
