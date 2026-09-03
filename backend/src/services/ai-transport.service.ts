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

export interface ReadAiResultsOptions {
  blockMs?: number;
  count?: number;
}

export interface AiResultDelivery {
  streamId: string;
  fields: Record<string, RedisArgument>;
}

type AiResultReadReply = Array<{
  name: string;
  messages: Array<{ id: string; message: Record<string, RedisArgument> }>;
}> | null;

type AiAutoClaimReply = {
  nextId: string;
  messages: Array<{ id: string; message: Record<string, RedisArgument> }>;
};

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

/** Reads and validates result entries after the supplied Redis stream cursor. */
export async function readAiResultsAfter(
  lastId: string,
  options: ReadAiResultsOptions = {},
  client?: Pick<RelayRedisClient, "xRead">
): Promise<AiResultStreamEntry[]> {
  const reader = client ?? (await connectRedis());
  const streams = (await reader.xRead(
    [{ key: env.AI_RESULT_STREAM, id: lastId }],
    { BLOCK: options.blockMs ?? 5_000, COUNT: options.count ?? 10 }
  )) as AiResultReadReply;

  return (streams ?? []).flatMap((stream) =>
    stream.messages.map((message) => parseAiResultEntry(message.id, message.message))
  );
}

/** Creates the durable Node result-consumer group once, including an empty stream. */
export async function ensureAiResultConsumerGroup(
  client?: Pick<RelayRedisClient, "xGroupCreate">
): Promise<void> {
  const reader = client ?? (await connectRedis());
  try {
    await reader.xGroupCreate(env.AI_RESULT_STREAM, env.AI_RESULT_CONSUMER_GROUP, "0", {
      MKSTREAM: true
    });
  } catch (error: unknown) {
    if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) throw error;
  }
}

/** Reads new result deliveries owned by this consumer until explicitly acknowledged. */
export async function readAiResultGroup(
  consumerName: string,
  options: ReadAiResultsOptions = {},
  client?: Pick<RelayRedisClient, "xReadGroup">
): Promise<AiResultDelivery[]> {
  const reader = client ?? (await connectRedis());
  const streams = (await reader.xReadGroup(
    env.AI_RESULT_CONSUMER_GROUP,
    consumerName,
    [{ key: env.AI_RESULT_STREAM, id: ">" }],
    { BLOCK: options.blockMs ?? 5_000, COUNT: options.count ?? 10 }
  )) as AiResultReadReply;

  return (streams ?? []).flatMap((stream) =>
    stream.messages.map((message) => ({ streamId: message.id, fields: message.message }))
  );
}

/** Reclaims abandoned result deliveries after another Node process dies. */
export async function claimStaleAiResults(
  consumerName: string,
  startId = "0-0",
  client?: Pick<RelayRedisClient, "xAutoClaim">
): Promise<{ nextId: string; deliveries: AiResultDelivery[] }> {
  const reader = client ?? (await connectRedis());
  const claimed = (await reader.xAutoClaim(
    env.AI_RESULT_STREAM,
    env.AI_RESULT_CONSUMER_GROUP,
    consumerName,
    env.AI_PENDING_IDLE_MS,
    startId,
    { COUNT: 10 }
  )) as AiAutoClaimReply;
  return {
    nextId: claimed.nextId,
    deliveries: claimed.messages.map((message) => ({
      streamId: message.id,
      fields: message.message
    }))
  };
}

/** Acknowledges a result only after MongoDB has committed its effect. */
export async function acknowledgeAiResult(
  streamId: string,
  client?: Pick<RelayRedisClient, "xAck">
): Promise<void> {
  const reader = client ?? (await connectRedis());
  await reader.xAck(env.AI_RESULT_STREAM, env.AI_RESULT_CONSUMER_GROUP, streamId);
}

/** Preserves malformed or terminal deliveries for operator review. */
export async function publishAiDeadLetter(
  sourceStream: string,
  streamId: string,
  error: string,
  rawEnvelope?: RedisArgument,
  client?: Pick<RelayRedisClient, "xAdd">
): Promise<void> {
  const writer = client ?? (await connectRedis());
  await writer.xAdd(env.AI_DEAD_LETTER_STREAM, "*", {
    sourceStream,
    sourceId: streamId,
    error: error.slice(0, 2_000),
    failedAt: new Date().toISOString(),
    ...(typeof rawEnvelope === "string" ? { [ENVELOPE_FIELD]: rawEnvelope } : {})
  });
}
