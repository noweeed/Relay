import { randomUUID } from "node:crypto";
import type { RedisArgument } from "redis";
import { env } from "../config/env";
import { connectRedis, type RelayRedisClient } from "../config/redis";
import {
  aiJobEnvelopeSchema,
  aiResultEnvelopeSchema,
  type AiJobEnvelope,
  type AiResultEnvelope
} from "../contracts/ai.contract";

const ENVELOPE_FIELD = "envelope";

export type PublishAiJobInput = Omit<AiJobEnvelope, "jobId" | "schemaVersion" | "createdAt"> & {
  jobId?: string;
};

export interface AiResultStreamEntry {
  streamId: string;
  result: AiResultEnvelope;
}

/** Builds and publishes one contract-validated AI job to Redis Streams. */
export async function publishAiJob(
  input: PublishAiJobInput,
  client?: Pick<RelayRedisClient, "xAdd">
): Promise<{ streamId: string; job: AiJobEnvelope }> {
  const job = aiJobEnvelopeSchema.parse({
    ...input,
    jobId: input.jobId ?? randomUUID(),
    schemaVersion: env.AI_JOB_SCHEMA_VERSION,
    createdAt: new Date().toISOString()
  });
  const writer = client ?? (await connectRedis());
  const streamId = await writer.xAdd(env.AI_JOB_STREAM, "*", {
    [ENVELOPE_FIELD]: JSON.stringify(job)
  });

  return { streamId, job };
}

/** Converts untrusted Redis fields into a validated Python result envelope. */
export function parseAiResultEntry(
  streamId: string,
  fields: Record<string, RedisArgument>
): AiResultStreamEntry {
  const rawEnvelope = fields[ENVELOPE_FIELD];
  if (typeof rawEnvelope !== "string") {
    throw new Error(`AI result ${streamId} is missing its string envelope field.`);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawEnvelope);
  } catch {
    throw new Error(`AI result ${streamId} contains invalid JSON.`);
  }

  return { streamId, result: aiResultEnvelopeSchema.parse(decoded) };
}
