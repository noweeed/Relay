import { createHash } from "node:crypto";
import { logger } from "../config/logger";
import { publishAiJob } from "./ai-transport.service";

export type EmbeddingResourceKind = "task" | "candidate";

/** Produces the same stable content marker when a job is queued and later applied. */
export function hashEmbeddingContent(title: string, description?: string): string {
  return createHash("sha256")
    .update(`${title.trim()}\n${description?.trim() ?? ""}`)
    .digest("hex");
}

/** Queues a best-effort embedding refresh without making ordinary task saves depend on AI uptime. */
export async function queueEmbeddingRefresh(input: {
  projectId: string;
  initiatingUserId: string;
  resourceId: string;
  resourceKind: EmbeddingResourceKind;
  title: string;
  description?: string;
}): Promise<void> {
  const text = `${input.title.trim()}\n${input.description?.trim() ?? ""}`.trim();
  try {
    await publishAiJob({
      jobType: "content.embed",
      projectId: input.projectId,
      initiatingUserId: input.initiatingUserId,
      resourceId: input.resourceId,
      payload: {
        resourceId: input.resourceId,
        resourceKind: input.resourceKind,
        text,
        contentHash: hashEmbeddingContent(input.title, input.description),
      },
    });
  } catch (error: unknown) {
    logger.warn(
      { error, resourceId: input.resourceId, resourceKind: input.resourceKind },
      "Embedding refresh could not be queued",
    );
  }
}
