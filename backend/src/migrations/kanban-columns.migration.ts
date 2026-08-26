import mongoose, { type ClientSession, type ObjectId } from "mongoose";
import {
  createDefaultKanbanColumns,
  type KanbanColumn,
  type KanbanColumnCategory
} from "../models/Project.model";

interface LegacyProjectRecord {
  _id: ObjectId;
  kanbanColumns?: KanbanColumn[];
}

export interface KanbanMigrationResult {
  projectsSeeded: number;
  tasksBackfilled: number;
  activitiesConverted: number;
}

/** Selects the first ordered column matching a legacy three-state category. */
function firstColumnId(columns: KanbanColumn[], category: KanbanColumnCategory): string {
  const matching = [...columns]
    .sort((left, right) => left.order - right.order)
    .find((column) => column.category === category);
  const todoFallback = columns.find((column) => column.category === "todo");
  if (!matching && !todoFallback) throw new Error("Kanban migration requires a Todo-category column.");
  return (matching ?? todoFallback)!.id;
}

/** Backfills one project inside a transaction so columns and task references cannot drift. */
async function migrateProject(
  project: LegacyProjectRecord,
  session: ClientSession
): Promise<{ projectSeeded: number; tasksBackfilled: number }> {
  const projects = mongoose.connection.collection<LegacyProjectRecord>("projects");
  const tasks = mongoose.connection.collection("tasks");
  const hasColumns = Array.isArray(project.kanbanColumns) && project.kanbanColumns.length > 0;
  const columns = hasColumns ? project.kanbanColumns! : createDefaultKanbanColumns();
  let projectSeeded = 0;
  let tasksBackfilled = 0;

  if (!hasColumns) {
    const result = await projects.updateOne(
      { _id: project._id },
      { $set: { kanbanColumns: columns } },
      { session }
    );
    projectSeeded = result.modifiedCount;
  }

  const legacyMappings: Array<[KanbanColumnCategory, string]> = [
    ["todo", firstColumnId(columns, "todo")],
    ["in_progress", firstColumnId(columns, "in_progress")],
    ["done", firstColumnId(columns, "done")]
  ];
  for (const [legacyStatus, columnId] of legacyMappings) {
    const result = await tasks.updateMany(
      { projectId: project._id, status: legacyStatus, columnId: { $exists: false } },
      { $set: { columnId } },
      { session }
    );
    tasksBackfilled += result.modifiedCount;
  }

  // Any malformed legacy task still receives the safe default Todo column.
  const missingResult = await tasks.updateMany(
    { projectId: project._id, columnId: { $exists: false } },
    { $set: { columnId: firstColumnId(columns, "todo") } },
    { session }
  );
  tasksBackfilled += missingResult.modifiedCount;

  // Remove the legacy field only after a stable destination has been written.
  await tasks.updateMany(
    { projectId: project._id, columnId: { $exists: true }, status: { $exists: true } },
    { $unset: { status: "" } },
    { session }
  );
  return { projectSeeded, tasksBackfilled };
}

/** Migrates fixed statuses to project columns and can safely be run more than once. */
export async function migrateKanbanColumns(): Promise<KanbanMigrationResult> {
  const projects = mongoose.connection.collection<LegacyProjectRecord>("projects");
  const activities = mongoose.connection.collection("taskactivities");
  const tasks = mongoose.connection.collection("tasks");
  const result: KanbanMigrationResult = {
    projectsSeeded: 0,
    tasksBackfilled: 0,
    activitiesConverted: 0
  };

  for await (const project of projects.find({})) {
    const projectResult = await mongoose.connection.transaction((session) =>
      migrateProject(project, session)
    );
    result.projectsSeeded += projectResult.projectSeeded;
    result.tasksBackfilled += projectResult.tasksBackfilled;
  }

  const activityResult = await activities.updateMany(
    { type: "status_changed" },
    { $set: { type: "column_changed" } }
  );
  result.activitiesConverted = activityResult.modifiedCount;

  await tasks.createIndex({ projectId: 1, columnId: 1, createdAt: -1 });
  const oldIndexName = "projectId_1_status_1_createdAt_-1";
  const indexes = await tasks.indexes();
  if (indexes.some((index) => index.name === oldIndexName)) await tasks.dropIndex(oldIndexName);

  return result;
}
