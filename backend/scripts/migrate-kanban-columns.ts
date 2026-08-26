import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { migrateKanbanColumns } from "../src/migrations/kanban-columns.migration";

/** Connects to Relay's configured database and runs the idempotent Kanban migration once. */
async function main(): Promise<void> {
  await connectDatabase();
  const result = await migrateKanbanColumns();
  console.log("Kanban migration complete.", result);
  await disconnectDatabase();
}

void main().catch(async (error: unknown) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
