import { Router, type Request, type Response } from "express";
import { loadAudio, verifySignedAudioUrl } from "../services/audio-storage.service";
import { asyncHandler } from "../utils/asyncHandler";

export const mediaRouter = Router();

/** Serves a short-lived worker URL without exposing permanent public audio access. */
async function getSignedAudio(request: Request, response: Response): Promise<void> {
  const storageKey = request.params.storageKey;
  if (typeof storageKey !== "string") {
    response.status(404).end();
    return;
  }
  verifySignedAudioUrl(storageKey, request.query.expires, request.query.signature);
  const audio = await loadAudio(storageKey);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Content-Type", "application/octet-stream");
  response.setHeader("Content-Length", audio.length);
  response.send(audio);
}

mediaRouter.get("/audio/:storageKey", asyncHandler(getSignedAudio));
