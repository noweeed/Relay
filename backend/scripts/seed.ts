import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { env } from "../src/config/env";
import { Membership } from "../src/models/Membership.model";
import { createDefaultKanbanColumns, Project } from "../src/models/Project.model";
import { User } from "../src/models/User.model";

/** Creates or updates a deterministic local demo user, project, and owner membership. */
async function seed(): Promise<void> {
  if (!env.SEED_USER_PASSWORD) {
    throw new Error("SEED_USER_PASSWORD must be set and contain at least 12 characters.");
  }

  await connectDatabase();
  const passwordHash = await bcrypt.hash(env.SEED_USER_PASSWORD, env.BCRYPT_ROUNDS);
  const user = await User.findOneAndUpdate(
    { email: "demo@relay.local" },
    { $set: { name: "Relay Demo", passwordHash } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  const project = await Project.findOneAndUpdate(
    { name: "Relay Demo Project", createdBy: user._id },
    { $setOnInsert: { description: "Seeded project for local Relay development." } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  if (project.kanbanColumns.length === 0) {
    // Existing demo projects created before custom columns receive the standard board once.
    project.kanbanColumns = createDefaultKanbanColumns();
    await project.save();
  }

  await Membership.updateOne(
    { projectId: project._id, userId: user._id },
    { $set: { role: "owner" } },
    { upsert: true }
  );
}

seed()
  .then(async () => {
    console.log("Relay demo data is ready.");
    await disconnectDatabase();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
