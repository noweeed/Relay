import { z } from "zod";

/** Job names shared by the Node API and Python worker. */
export const aiJobTypeSchema = z.enum([
  "meeting.process",
  "meeting.reprocess",
  "meeting.transcribe",
  "command.interpret",
  "content.embed"
]);

/** Validates every job before Node publishes it to the AI transport. */
export const aiJobEnvelopeSchema = z.strictObject({
  jobId: z.string().min(1),
  jobType: aiJobTypeSchema,
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  initiatingUserId: z.string().min(1),
  resourceId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown())
});

const aiErrorSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean()
});

const aiResultBaseSchema = z.strictObject({
  jobId: z.string().min(1),
  jobType: aiJobTypeSchema,
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  resourceId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  completedAt: z.iso.datetime()
});

/** Validates untrusted Python results before any MongoDB write occurs. */
export const aiResultEnvelopeSchema = z.discriminatedUnion("status", [
  aiResultBaseSchema.extend({
    status: z.literal("succeeded"),
    payload: z.record(z.string(), z.unknown())
  }),
  aiResultBaseSchema.extend({
    status: z.literal("failed"),
    error: aiErrorSchema
  })
]);

export type AiJobEnvelope = z.infer<typeof aiJobEnvelopeSchema>;
export type AiResultEnvelope = z.infer<typeof aiResultEnvelopeSchema>;

/** Validates one evidence-backed task returned by the Python meeting graph. */
export const meetingExtractedTaskSchema = z.strictObject({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5_000).nullable().optional(),
  assigneeName: z.string().trim().min(1).max(100).nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  segmentOrder: z.number().int().nonnegative(),
  sourceQuote: z.string().trim().min(1).max(2_000),
  confidence: z.number().min(0).max(1).nullable().optional(),
  embedding: z.array(z.number().finite()).min(1).max(8_192).optional(),
  duplicate: z
    .strictObject({
      existingTaskId: z.string().regex(/^[a-f\d]{24}$/i),
      similarityLabel: z.enum(["medium", "high"]),
      similarityScore: z.number().min(0).max(1),
      verification: z.enum(["same_work", "related_but_separate", "unrelated"]).optional()
    })
    .nullable()
    .optional()
});

/** Validates the successful payload before AI output is persisted in MongoDB. */
export const meetingExtractionResultSchema = z.strictObject({
  meetingId: z.string().min(1),
  transcript: z.array(z.strictObject({
    order: z.number().int().nonnegative(),
    speaker: z.string().trim().min(1).max(100).nullable().optional(),
    text: z.string().trim().min(1).max(500_000),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative()
  })).optional(),
  tasks: z.array(meetingExtractedTaskSchema)
});

export type MeetingExtractionResult = z.infer<typeof meetingExtractionResultSchema>;

export const commandTaskContextSchema = z.strictObject({
  id: z.string().regex(/^[a-f\d]{24}$/i),
  title: z.string().trim().min(1).max(200),
  columnId: z.string().min(1),
  assigneeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export const commandInterpretPayloadSchema = z.strictObject({
  commandId: z.string().regex(/^[a-f\d]{24}$/i),
  text: z.string().trim().min(1).max(1_000),
  tasks: z.array(commandTaskContextSchema).max(1_000),
  columns: z.array(z.strictObject({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(40),
    category: z.enum(["todo", "in_progress", "done"]),
  })).min(1).max(20),
  members: z.array(z.strictObject({
    id: z.string().regex(/^[a-f\d]{24}$/i),
    name: z.string().trim().min(1).max(80),
  })).max(1_000),
});

export const commandInterpretResultSchema = z.strictObject({
  commandId: z.string().regex(/^[a-f\d]{24}$/i),
  status: z.enum(["resolved", "ambiguous", "unsupported"]),
  intent: z.enum(["list_overdue_tasks", "update_task_status", "assign_task", "unknown"]),
  taskId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  targetColumnId: z.string().min(1).optional(),
  targetAssigneeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  requiresConfirmation: z.boolean(),
  preview: z.string().trim().min(1).max(1_000),
  candidateMatches: z.array(z.strictObject({
    id: z.string().regex(/^[a-f\d]{24}$/i),
    label: z.string().trim().min(1).max(200),
  })).max(20),
});

export type CommandInterpretPayload = z.infer<typeof commandInterpretPayloadSchema>;
export type CommandInterpretResult = z.infer<typeof commandInterpretResultSchema>;

export const contentEmbeddingResultSchema = z.strictObject({
  resourceId: z.string().regex(/^[a-f\d]{24}$/i),
  resourceKind: z.enum(["task", "candidate"]),
  contentHash: z.string().regex(/^[a-f\d]{64}$/i),
  embedding: z.array(z.number().finite()).min(1).max(8_192),
});
