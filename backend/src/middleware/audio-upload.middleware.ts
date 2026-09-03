import type { RequestHandler } from "express";
import multer from "multer";
import { env } from "../config/env";
import { ACCEPTED_AUDIO_MIME_TYPES } from "../services/audio-storage.service";
import { ApiError } from "../utils/ApiError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: env.AUDIO_MAX_BYTES },
  fileFilter: (_request, file, callback) => {
    if (ACCEPTED_AUDIO_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new ApiError(400, "INVALID_AUDIO", "Upload an MP3, WAV, or M4A file."));
  }
});

/** Parses exactly one bounded `audio` multipart field and normalizes Multer errors. */
export const parseAudioUpload: RequestHandler = (request, response, next) => {
  upload.single("audio")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new ApiError(
        400,
        error.code === "LIMIT_FILE_SIZE" ? "AUDIO_TOO_LARGE" : "INVALID_AUDIO_UPLOAD",
        error.code === "LIMIT_FILE_SIZE"
          ? `Audio files must be ${Math.floor(env.AUDIO_MAX_BYTES / 1_000_000)} MB or smaller.`
          : "The audio upload is invalid."
      ));
      return;
    }
    next(error);
  });
};
