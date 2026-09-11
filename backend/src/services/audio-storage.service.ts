import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

const AUDIO_TYPES = {
  "audio/mpeg": { extension: ".mp3", label: "MP3" },
  "audio/wav": { extension: ".wav", label: "WAV" },
  "audio/x-wav": { extension: ".wav", label: "WAV" },
  "audio/mp4": { extension: ".m4a", label: "M4A" },
  "audio/x-m4a": { extension: ".m4a", label: "M4A" }
} as const;

export const ACCEPTED_AUDIO_MIME_TYPES = new Set<string>(Object.keys(AUDIO_TYPES));

export interface StoredAudio {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

let s3Client: S3Client | undefined;

function getS3(): { client: S3Client; bucket: string } {
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required for S3 audio storage."
    );
  }
  s3Client ??= new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    }
  });
  return { client: s3Client, bucket: env.S3_BUCKET };
}

/** Removes path components and control characters while retaining a useful display name. */
export function sanitizeAudioFilename(filename: string): string {
  const basename = path.basename(filename.replaceAll("\\", "/"));
  const withoutControls = [...basename]
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join("");
  const cleaned = withoutControls
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();
  return (cleaned || "meeting-audio").slice(0, 255);
}

/** Checks the container signature as well as the browser-supplied MIME type. */
export function validateAudioContents(buffer: Buffer, mimeType: string): void {
  const mp3 = buffer.subarray(0, 3).toString("ascii") === "ID3" ||
    (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0);
  const wav = buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE";
  const m4a = buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  const expected = AUDIO_TYPES[mimeType as keyof typeof AUDIO_TYPES]?.label;
  const valid = expected === "MP3" ? mp3 : expected === "WAV" ? wav : expected === "M4A" ? m4a : false;
  if (!valid) {
    throw new ApiError(400, "INVALID_AUDIO", "The uploaded file does not contain valid MP3, WAV, or M4A audio.");
  }
}

function resolveStoragePath(storageKey: string): string {
  if (!/^[a-f\d-]{36}\.(mp3|wav|m4a)$/i.test(storageKey)) {
    throw new ApiError(404, "NOT_FOUND", "Meeting audio was not found.");
  }
  return path.resolve(env.AUDIO_STORAGE_DIR, storageKey);
}

/** Local implementation of the storage boundary; callers persist only its opaque key. */
export async function storeAudio(file: Express.Multer.File): Promise<StoredAudio> {
  validateAudioContents(file.buffer, file.mimetype);
  const type = AUDIO_TYPES[file.mimetype as keyof typeof AUDIO_TYPES];
  if (!type) throw new ApiError(400, "INVALID_AUDIO", "Upload an MP3, WAV, or M4A file.");
  const storageKey = `${randomUUID()}${type.extension}`;
  if (env.AUDIO_STORAGE_PROVIDER === "s3") {
    const { client, bucket } = getS3();
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: { originalName: sanitizeAudioFilename(file.originalname) }
    }));
  } else {
    await mkdir(path.resolve(env.AUDIO_STORAGE_DIR), { recursive: true });
    await writeFile(resolveStoragePath(storageKey), file.buffer, { flag: "wx" });
  }
  return {
    storageKey,
    originalName: sanitizeAudioFilename(file.originalname),
    mimeType: file.mimetype,
    sizeBytes: file.size
  };
}

export async function loadAudio(storageKey: string): Promise<Buffer> {
  resolveStoragePath(storageKey);
  if (env.AUDIO_STORAGE_PROVIDER === "s3") {
    const { client, bucket } = getS3();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
    if (!result.Body) throw new ApiError(404, "NOT_FOUND", "Meeting audio was not found.");
    return Buffer.from(await result.Body.transformToByteArray());
  }
  try {
    return await readFile(resolveStoragePath(storageKey));
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      throw new ApiError(404, "NOT_FOUND", "Meeting audio was not found.");
    }
    throw error;
  }
}

export async function deleteAudio(storageKey: string): Promise<void> {
  resolveStoragePath(storageKey);
  if (env.AUDIO_STORAGE_PROVIDER === "s3") {
    const { client, bucket } = getS3();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    return;
  }
  await unlink(resolveStoragePath(storageKey)).catch((error: unknown) => {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  });
}

function audioSignature(storageKey: string, expiresAt: number): string {
  return createHmac("sha256", env.AUDIO_SIGNING_SECRET ?? env.JWT_ACCESS_SECRET)
    .update(`${storageKey}:${expiresAt}`)
    .digest("hex");
}

/** Creates a short-lived URL the independently deployed Python worker can fetch. */
export async function createSignedAudioUrl(
  storageKey: string,
  lifetimeSeconds = 3_600
): Promise<string> {
  resolveStoragePath(storageKey);
  if (env.AUDIO_STORAGE_PROVIDER === "s3") {
    const { client, bucket } = getS3();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
      { expiresIn: lifetimeSeconds }
    );
  }
  const expiresAt = Math.floor(Date.now() / 1_000) + lifetimeSeconds;
  const url = new URL(`/api/media/audio/${storageKey}`, env.API_PUBLIC_URL);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("signature", audioSignature(storageKey, expiresAt));
  return url.toString();
}

/** Verifies expiry and signature before serving worker-only audio bytes. */
export function verifySignedAudioUrl(
  storageKey: string,
  expiresValue: unknown,
  signatureValue: unknown
): void {
  resolveStoragePath(storageKey);
  const expiresAt = typeof expiresValue === "string" ? Number(expiresValue) : Number.NaN;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1_000)) {
    throw new ApiError(403, "FORBIDDEN", "This audio link has expired.");
  }
  if (typeof signatureValue !== "string" || !/^[a-f\d]{64}$/i.test(signatureValue)) {
    throw new ApiError(403, "FORBIDDEN", "This audio link is invalid.");
  }
  const provided = Buffer.from(signatureValue, "hex");
  const expected = Buffer.from(audioSignature(storageKey, expiresAt), "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new ApiError(403, "FORBIDDEN", "This audio link is invalid.");
  }
}
