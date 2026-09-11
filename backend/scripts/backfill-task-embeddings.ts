import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { Task } from "../src/models/Task.model";
import { queueEmbeddingRefresh } from "../src/services/embedding-refresh.service";

async function backfillTaskEmbeddings(): Promise<void> {
  await connectDatabase();
  const tasks = await Task.find({}).select({ title: 1, description: 1, projectId: 1, createdBy: 1 });
  for (const task of tasks) {
    await queueEmbeddingRefresh({
      projectId: task.projectId.toString(),
      initiatingUserId: task.createdBy.toString(),
      resourceId: task._id.toString(),
      resourceKind: "task",
      title: task.title,
      ...(task.description ? { description: task.description } : {}),
    });
  }
  console.log(`Queued ${tasks.length} task embedding refreshes.`);
}

backfillTaskEmbeddings()
  .then(disconnectDatabase)
  .catch(async (error: unknown) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
