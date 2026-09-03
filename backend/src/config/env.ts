import "dotenv/config";
import { z } from "zod";

/** Treats an empty optional environment value as unset. */
const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional()
);
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional()
);

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(5_000),
  MONGODB_URI: z.string().trim().min(1, "MONGODB_URI is required"),
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must contain at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must contain at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().min(1).default("15m"),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .max(365)
    .default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  REFRESH_COOKIE_NAME: z.string().trim().min(1).default("relay_refresh_token"),
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
  REDIS_URL: optionalUrl,
  AI_JOB_STREAM: z.string().trim().min(1).default("relay:ai:jobs"),
  AI_RESULT_STREAM: z.string().trim().min(1).default("relay:ai:results"),
  AI_DEAD_LETTER_STREAM: z.string().trim().min(1).default("relay:ai:dead-letter"),
  AI_JOB_SCHEMA_VERSION: z.coerce.number().pipe(z.literal(1)).default(1),
  AI_RESULT_SCHEMA_VERSION: z.coerce.number().pipe(z.literal(1)).default(1),
  AI_WORKER_CONSUMER_GROUP: z.string().trim().min(1).default("relay-ai-workers"),
  AI_RESULT_CONSUMER_GROUP: z.string().trim().min(1).default("relay-api-results"),
  AI_RESULT_CONSUMER_NAME: optionalText,
  AI_PENDING_IDLE_MS: z.coerce.number().int().positive().default(30_000),
  AI_CONSUMER_RETRY_BASE_MS: z.coerce.number().int().positive().default(500),
  AI_CONSUMER_RETRY_MAX_MS: z.coerce.number().int().positive().default(30_000),
  AUDIO_STORAGE_DIR: z.string().trim().min(1).default(".relay-data/audio"),
  AUDIO_MAX_BYTES: z.coerce.number().int().positive().max(500_000_000).default(25_000_000),
  SEED_USER_PASSWORD: z.string().min(12).optional(),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsedEnvironment.data;
