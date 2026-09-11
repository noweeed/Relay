import { Notification, type NotificationType } from "../models/Notification.model";
import { Membership } from "../models/Membership.model";
import { Project } from "../models/Project.model";
import { Task, type TaskDocument } from "../models/Task.model";
import { User, type NotificationPreferences } from "../models/User.model";
import { emitNotificationCreated } from "../sockets/notificationEvents";
import { serializeNotification } from "./notification.service";

export interface DeadlineMonitorOptions {
  now?: Date;
  upcomingHours?: number;
}

export interface DeadlineMonitorResult {
  scanned: number;
  created: number;
  deduplicated: number;
  skippedByPreference: number;
}

interface DeadlineCandidate {
  task: TaskDocument;
  userId: string;
  type: Extract<NotificationType, "deadline_upcoming" | "task_overdue">;
}

function formatDueDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function allowsDeadlineNotification(
  preferences: NotificationPreferences,
  type: DeadlineCandidate["type"],
): boolean {
  if (!preferences.inAppNotifications) return false;
  return type === "task_overdue" ? preferences.overdueTasks : preferences.upcomingDeadlines;
}

/** Runs deterministic deadline checks and creates each due-date notification at most once. */
export async function runDeadlineMonitor(
  options: DeadlineMonitorOptions = {},
): Promise<DeadlineMonitorResult> {
  const now = options.now ?? new Date();
  const upcomingHours = options.upcomingHours ?? 24;
  const upcomingEnd = new Date(now.getTime() + upcomingHours * 60 * 60 * 1_000);

  const tasks = await Task.find({ dueDate: { $lte: upcomingEnd } });
  const projectIds = [...new Set(tasks.map((task) => task.projectId.toString()))];
  const projects = await Project.find({ _id: { $in: projectIds } }, { kanbanColumns: 1 }).lean();
  const doneColumnsByProject = new Map(
    projects.map((project) => [
      project._id.toString(),
      new Set(project.kanbanColumns.filter((column) => column.category === "done").map((column) => column.id)),
    ]),
  );

  const candidates: DeadlineCandidate[] = [];
  for (const task of tasks) {
    if (!task.dueDate) continue;
    if (doneColumnsByProject.get(task.projectId.toString())?.has(task.columnId)) continue;
    const assigneeIds = (task.assigneeIds ?? []).map((id) => id.toString());
    if (assigneeIds.length === 0 && task.assigneeId) assigneeIds.push(task.assigneeId.toString());
    const recipientIds = assigneeIds.length > 0 ? [...new Set(assigneeIds)] : [task.createdBy.toString()];
    for (const userId of recipientIds) {
      candidates.push({
        task,
        userId,
        type: task.dueDate.getTime() < now.getTime() ? "task_overdue" : "deadline_upcoming",
      });
    }
  }

  const memberships = candidates.length === 0
    ? []
    : await Membership.find({
        projectId: { $in: [...new Set(candidates.map((candidate) => candidate.task.projectId.toString()))] },
        userId: { $in: [...new Set(candidates.map((candidate) => candidate.userId))] },
      })
        .select({ projectId: 1, userId: 1 })
        .lean();
  const allowedRecipients = new Set(
    memberships.map((membership) => `${membership.projectId.toString()}:${membership.userId.toString()}`),
  );
  const authorizedCandidates = candidates.filter((candidate) =>
    allowedRecipients.has(`${candidate.task.projectId.toString()}:${candidate.userId}`),
  );

  const users = await User.find(
    { _id: { $in: [...new Set(authorizedCandidates.map((candidate) => candidate.userId))] } },
    { notificationPreferences: 1 },
  ).lean();
  const preferencesByUser = new Map(
    users.map((user) => [user._id.toString(), user.notificationPreferences]),
  );

  let created = 0;
  let deduplicated = 0;
  let skippedByPreference = 0;
  for (const candidate of authorizedCandidates) {
    const preferences = preferencesByUser.get(candidate.userId);
    if (!preferences || !allowsDeadlineNotification(preferences, candidate.type)) {
      skippedByPreference += 1;
      continue;
    }

    const dueDate = candidate.task.dueDate!;
    const dedupeKey = `${candidate.userId}:${candidate.task._id.toString()}:${candidate.type}:${dueDate.toISOString()}`;
    const title = candidate.type === "task_overdue" ? "Task overdue" : "Deadline approaching";
    const body =
      candidate.type === "task_overdue"
        ? `“${candidate.task.title}” was due ${formatDueDate(dueDate)}.`
        : `“${candidate.task.title}” is due ${formatDueDate(dueDate)}.`;

    const result = await Notification.updateOne(
      { dedupeKey },
      {
        $setOnInsert: {
          userId: candidate.userId,
          projectId: candidate.task.projectId,
          type: candidate.type,
          title,
          body,
          relatedTaskId: candidate.task._id,
          dedupeKey,
        },
      },
      { upsert: true },
    );
    if (!result.upsertedId) {
      deduplicated += 1;
      continue;
    }

    const notification = await Notification.findById(result.upsertedId);
    if (notification) {
      created += 1;
      emitNotificationCreated(candidate.userId, serializeNotification(notification));
    }
  }

  return { scanned: authorizedCandidates.length, created, deduplicated, skippedByPreference };
}
