import { Membership } from "../models/Membership.model";
import { Project, type KanbanColumn } from "../models/Project.model";
import { Task } from "../models/Task.model";
import { TaskActivity, type TaskActivityDocument } from "../models/TaskActivity.model";
import { ApiError } from "../utils/ApiError";

export interface ColumnCount {
  columnId: string;
  columnName: string;
  color: string;
  category: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface RecentActivityEntry {
  id: string;
  taskId: string;
  actorId?: string;
  actorType: string;
  type: string;
  createdAt: Date;
}

export interface ProjectOverviewResponse {
  totalTasks: number;
  byColumn: ColumnCount[];
  byCategory: CategoryCount[];
  overdueCount: number;
  memberCount: number;
  recentActivity: RecentActivityEntry[];
}

/** Serializes a TaskActivity document into a lightweight recent-activity entry. */
function serializeRecentActivity(activity: TaskActivityDocument): RecentActivityEntry {
  return {
    id: activity._id.toString(),
    taskId: activity.taskId.toString(),
    ...(activity.actorId ? { actorId: activity.actorId.toString() } : {}),
    actorType: activity.actorType,
    type: activity.type,
    createdAt: activity.createdAt
  };
}

/** Builds a project dashboard overview without loading every task individually. */
export async function getProjectOverview(projectId: string): Promise<ProjectOverviewResponse> {
  const project = await Project.findById(projectId, { kanbanColumns: 1 }).lean();
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project was not found.");

  const columns: KanbanColumn[] = [...project.kanbanColumns].sort(
    (left, right) => left.order - right.order
  );

  // Run the independent queries concurrently for speed.
  const [taskCountsByColumn, overdueCount, memberCount, recentActivity] = await Promise.all([
    Task.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: project._id } },
      { $group: { _id: "$columnId", count: { $sum: 1 } } }
    ]),
    Task.countDocuments({
      projectId,
      dueDate: { $lt: new Date() },
      // Only count tasks in non-done columns as overdue.
      columnId: {
        $in: columns
          .filter((column) => column.category !== "done")
          .map((column) => column.id)
      }
    }),
    Membership.countDocuments({ projectId }),
    TaskActivity.find({ projectId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(20)
      .exec()
  ]);

  const countMap = new Map(taskCountsByColumn.map((entry) => [entry._id, entry.count]));

  const byColumn: ColumnCount[] = columns.map((column) => ({
    columnId: column.id,
    columnName: column.name,
    color: column.color,
    category: column.category,
    count: countMap.get(column.id) ?? 0
  }));

  // Aggregate by category from the already-computed per-column counts.
  const categoryCounts = new Map<string, number>();
  for (const entry of byColumn) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + entry.count);
  }
  const byCategory: CategoryCount[] = ["todo", "in_progress", "done"].map((category) => ({
    category,
    count: categoryCounts.get(category) ?? 0
  }));

  const totalTasks = byColumn.reduce((sum, entry) => sum + entry.count, 0);

  return {
    totalTasks,
    byColumn,
    byCategory,
    overdueCount,
    memberCount,
    recentActivity: recentActivity.map(serializeRecentActivity)
  };
}
