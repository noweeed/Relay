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
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  due: string | null;
  priority: Priority;
  status: Status;
  columnId?: string;
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
  assigneeId: string | null;
  due: string | null;
  priority: Priority;
  timestamp: string;
  quote: string;
  state: "pending" | "approved" | "rejected";
  duplicateOf?: { taskId: string; confidence: "high" | "medium"; existingDue: string | null };
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

export const members: Member[] = [
  { id: "naveed", name: "Naveed Iqbal", email: "naveed@relay.work", role: "Backend engineer" },
  { id: "abdullah", name: "Abdullah Raza", email: "abdullah@relay.work", role: "Product design" },
  { id: "huzaifa", name: "Huzaifa Khan", email: "huzaifa@relay.work", role: "Frontend engineer" },
  { id: "sana", name: "Sana Mir", email: "sana@relay.work", role: "Engineering manager" },
];

export const currentUser = members[3]!;

export const initialProjects: Project[] = [
  { id: "atlas", name: "Atlas Web App", description: "Customer-facing web application" },
  { id: "mobile", name: "Mobile Redesign", description: "iOS and Android refresh" },
  { id: "research", name: "Research Project", description: "Discovery and user interviews" },
];

const act = (id: string, text: string, at: string): ActivityEntry => ({ id, text, at });

export const initialTasks: Task[] = [
  {
    id: "t1",
    projectId: "atlas",
    title: "Finalize authentication flow",
    description:
      "Wire the login and session refresh endpoints to the new token service and cover the failure paths.",
    assigneeId: "naveed",
    due: "2026-08-26",
    priority: "high",
    status: "in_progress",
    sourceMeetingId: "m1",
    sourceTimestamp: "18:32",
    sourceQuote: "I'll finish the authentication API by Friday.",
    activity: [
      act("a1", "Task extracted from Weekly Product Sync", "Aug 22, 09:40"),
      act("a2", "Sana approved task", "Aug 22, 10:02"),
      act("a3", "Status changed from Todo to In Progress", "Aug 23, 08:15"),
      act("a4", "Deadline changed Aug 25 to Aug 26", "Aug 23, 08:16"),
    ],
  },
  {
    id: "t2",
    projectId: "atlas",
    title: "Implement password reset endpoint",
    description: "Email-based reset with a 30 minute token expiry.",
    assigneeId: "naveed",
    due: "2026-08-29",
    priority: "medium",
    status: "todo",
    sourceMeetingId: "m2",
    sourceTimestamp: "07:14",
    sourceQuote: "Password reset still isn't built, we need it before the beta.",
    activity: [act("a5", "Task extracted from Backend Planning", "Aug 19, 15:20")],
  },
  {
    id: "t3",
    projectId: "atlas",
    title: "Review dashboard navigation",
    description: "Check the sidebar grouping against the latest information architecture.",
    assigneeId: "abdullah",
    due: "2026-08-28",
    priority: "medium",
    status: "todo",
    sourceMeetingId: "m3",
    sourceTimestamp: "12:05",
    sourceQuote: "Abdullah can take another pass at the dashboard navigation this week.",
    activity: [act("a6", "Task extracted from UI Review", "Aug 20, 11:00")],
  },
  {
    id: "t4",
    projectId: "atlas",
    title: "Prepare API documentation",
    description: "Public reference for the tasks and meetings endpoints.",
    assigneeId: "huzaifa",
    due: "2026-08-22",
    priority: "low",
    status: "todo",
    activity: [act("a7", "Task created manually by Sana", "Aug 14, 16:30")],
  },
  {
    id: "t5",
    projectId: "atlas",
    title: "Fix onboarding validation",
    description: "Company field accepts empty strings and breaks the invite step.",
    assigneeId: "huzaifa",
    due: "2026-08-21",
    priority: "high",
    status: "in_progress",
    sourceMeetingId: "m4",
    sourceTimestamp: "22:47",
    sourceQuote: "The onboarding form lets you through with an empty company name.",
    activity: [
      act("a8", "Task extracted from Sprint Planning", "Aug 18, 10:10"),
      act("a9", "Status changed from Todo to In Progress", "Aug 20, 09:30"),
    ],
  },
  {
    id: "t6",
    projectId: "atlas",
    title: "Connect user profile API",
    description: "Replace the mocked profile response in the settings screen.",
    assigneeId: "huzaifa",
    due: "2026-09-02",
    priority: "medium",
    status: "todo",
    activity: [act("a10", "Task created manually by Huzaifa", "Aug 21, 13:05")],
  },
  {
    id: "t7",
    projectId: "atlas",
    title: "Update database schema",
    description: "Add the sessions table and backfill existing rows.",
    assigneeId: "naveed",
    due: "2026-08-20",
    priority: "medium",
    status: "done",
    sourceMeetingId: "m2",
    sourceTimestamp: "19:03",
    sourceQuote: "Schema change for sessions should land before anything else.",
    activity: [
      act("a11", "Task extracted from Backend Planning", "Aug 19, 15:22"),
      act("a12", "Status changed from In Progress to Done", "Aug 20, 17:44"),
    ],
  },
  {
    id: "t8",
    projectId: "atlas",
    title: "Complete authentication backend",
    description: "Token service, refresh handling and session storage.",
    assigneeId: "naveed",
    due: "2026-08-25",
    priority: "high",
    status: "in_progress",
    sourceMeetingId: "m2",
    sourceTimestamp: "05:41",
    sourceQuote: "Authentication backend is the blocker for everything else this sprint.",
    activity: [act("a13", "Task extracted from Backend Planning", "Aug 19, 15:18")],
  },
  {
    id: "t9",
    projectId: "atlas",
    title: "Write release notes for 1.4",
    description: "Summarize the changes shipped in the August release.",
    assigneeId: "abdullah",
    due: "2026-08-18",
    priority: "low",
    status: "done",
    activity: [act("a14", "Task created manually by Sana", "Aug 12, 09:00")],
  },
];

export const initialMeetings: Meeting[] = [
  {
    id: "m1",
    projectId: "atlas",
    title: "Weekly Product Sync",
    date: "2026-08-22",
    durationMin: 42,
    participantIds: ["naveed", "abdullah", "huzaifa", "sana"],
    status: "reviewed",
    transcript: [
      {
        id: "s1",
        time: "18:20",
        speakerId: "sana",
        text: "Let's go through what's left before the beta cut.",
      },
      {
        id: "s2",
        time: "18:28",
        speakerId: "abdullah",
        text: "We should finish authentication before starting account settings.",
      },
      {
        id: "s3",
        time: "18:32",
        speakerId: "naveed",
        text: "I'll finish the authentication API by Friday.",
        taskId: "t1",
      },
      {
        id: "s4",
        time: "18:39",
        speakerId: "huzaifa",
        text: "Onboarding validation is still failing on the company field, I'll pick that up.",
        taskId: "t5",
      },
      {
        id: "s5",
        time: "18:47",
        speakerId: "sana",
        text: "Good. Let's keep the release notes short this time.",
      },
    ],
  },
  {
    id: "m2",
    projectId: "atlas",
    title: "Backend Planning",
    date: "2026-08-19",
    durationMin: 28,
    participantIds: ["naveed", "sana"],
    status: "reviewed",
    transcript: [
      {
        id: "s6",
        time: "05:41",
        speakerId: "naveed",
        text: "Authentication backend is the blocker for everything else this sprint.",
        taskId: "t8",
      },
      {
        id: "s7",
        time: "07:14",
        speakerId: "sana",
        text: "Password reset still isn't built, we need it before the beta.",
        taskId: "t2",
      },
      {
        id: "s8",
        time: "19:03",
        speakerId: "naveed",
        text: "Schema change for sessions should land before anything else.",
        taskId: "t7",
      },
    ],
  },
  {
    id: "m3",
    projectId: "atlas",
    title: "UI Review",
    date: "2026-08-20",
    durationMin: 35,
    participantIds: ["abdullah", "huzaifa", "sana"],
    status: "needs_review",
    transcript: [
      {
        id: "s9",
        time: "12:05",
        speakerId: "sana",
        text: "Abdullah can take another pass at the dashboard navigation this week.",
        taskId: "t3",
      },
      {
        id: "s10",
        time: "21:30",
        speakerId: "huzaifa",
        text: "The empty states in the board still say no data, that needs copy.",
      },
    ],
  },
  {
    id: "m4",
    projectId: "atlas",
    title: "Sprint Planning",
    date: "2026-08-18",
    durationMin: 51,
    participantIds: ["naveed", "abdullah", "huzaifa", "sana"],
    status: "reviewed",
    transcript: [
      {
        id: "s11",
        time: "22:47",
        speakerId: "huzaifa",
        text: "The onboarding form lets you through with an empty company name.",
        taskId: "t5",
      },
      {
        id: "s12",
        time: "31:12",
        speakerId: "sana",
        text: "We'll carry the documentation work into next sprint.",
      },
    ],
  },
];

export const initialCandidates: Candidate[] = [
  {
    id: "c1",
    meetingId: "m3",
    title: "Finish authentication API",
    assigneeId: "naveed",
    due: "2026-08-26",
    priority: "high",
    timestamp: "18:32",
    quote: "Naveed will finish the authentication API by Friday.",
    state: "pending",
    duplicateOf: { taskId: "t8", confidence: "high", existingDue: "2026-08-25" },
  },
  {
    id: "c2",
    meetingId: "m3",
    title: "Rewrite empty state copy on the board",
    assigneeId: "huzaifa",
    due: "2026-08-27",
    priority: "medium",
    timestamp: "21:30",
    quote: "The empty states in the board still say no data, that needs copy.",
    state: "pending",
  },
  {
    id: "c3",
    meetingId: "m3",
    title: "Audit sidebar grouping against the new IA",
    assigneeId: "abdullah",
    due: "2026-08-28",
    priority: "medium",
    timestamp: "12:05",
    quote: "Abdullah can take another pass at the dashboard navigation this week.",
    state: "pending",
  },
  {
    id: "c4",
    meetingId: "m3",
    title: "Add keyboard focus styles to task cards",
    assigneeId: "huzaifa",
    due: "2026-09-01",
    priority: "low",
    timestamp: "26:04",
    quote: "You can't tab through the board right now, focus is invisible.",
    state: "pending",
  },
  {
    id: "c5",
    meetingId: "m3",
    title: "Share the review screen recording with the team",
    assigneeId: "sana",
    due: "2026-08-24",
    priority: "low",
    timestamp: "33:18",
    quote: "I'll send the recording of this review round to everyone after the call.",
    state: "pending",
  },
];

export const initialNotifications: Notification[] = [
  {
    id: "n1",
    kind: "review",
    title: "Meeting ready for review",
    body: "5 action items were extracted from UI Review.",
    at: "12 minutes ago",
    read: false,
  },
  {
    id: "n2",
    kind: "deadline",
    title: "Deadline tomorrow",
    body: "Finalize authentication flow is due tomorrow.",
    at: "3 hours ago",
    read: false,
  },
  {
    id: "n3",
    kind: "overdue",
    title: "Task overdue",
    body: "Prepare API documentation was due yesterday.",
    at: "Yesterday",
    read: true,
  },
];

export const activityFeed = [
  {
    id: "af1",
    who: "naveed",
    text: 'moved "Finalize authentication flow" to In Progress.',
    at: "2h ago",
  },
  { id: "af2", who: "sana", text: "approved 3 tasks from Weekly Product Sync.", at: "5h ago" },
  {
    id: "af3",
    who: "huzaifa",
    text: 'changed the deadline for "Fix onboarding validation".',
    at: "Yesterday",
  },
  {
    id: "af4",
    who: "abdullah",
    text: 'commented on "Review dashboard navigation".',
    at: "Yesterday",
  },
];

export const TODAY = new Date("2026-08-23T10:00:00Z");

export function memberById(id: string | null | undefined) {
  return members.find((m) => m.id === id);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

export function formatDate(iso: string | null) {
  if (!iso) return "No date";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatLongDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isOverdue(task: Task) {
  if (!task.due || task.status === "done") return false;
  return new Date(task.due + "T23:59:59Z") < TODAY;
}

export function dueThisWeek(task: Task) {
  if (!task.due || task.status === "done") return false;
  const d = new Date(task.due + "T00:00:00Z").getTime();
  return d >= TODAY.getTime() - 864e5 && d <= TODAY.getTime() + 7 * 864e5;
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
