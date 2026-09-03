import { z } from "zod";

/** Job names shared by the Node API and Python worker. */
export const aiJobTypeSchema = z.enum([
  "meeting.process",
  "meeting.reprocess",
  "command.interpret"
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
  confidence: z.number().min(0).max(1).nullable().optional()
});

/** Validates the successful payload before AI output is persisted in MongoDB. */
export const meetingExtractionResultSchema = z.strictObject({
  meetingId: z.string().min(1),
  tasks: z.array(meetingExtractedTaskSchema)
});

export type MeetingExtractionResult = z.infer<typeof meetingExtractionResultSchema>;
