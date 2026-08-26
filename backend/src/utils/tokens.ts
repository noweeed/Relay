import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "./ApiError";

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  type: "access";
}

interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  type: "refresh";
  sessionId: string;
  jti: string;
}

/** Creates the short-lived bearer token used to authenticate API requests. */
export function signAccessToken(userId: string): string {
  return jwt.sign({ type: "access" }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
  });
}

/** Creates a rotating refresh JWT tied to a server-side session record. */
export function signRefreshToken(userId: string, sessionId: string): string {
  return jwt.sign(
    { type: "refresh", sessionId, jti: randomUUID() },
    env.JWT_REFRESH_SECRET,
    {
      subject: userId,
      expiresIn: `${env.JWT_REFRESH_EXPIRES_IN_DAYS}d`
    }
  );
}

/** Verifies an access token and rejects tokens issued for another purpose. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "The access token is invalid or expired.");
  }

  if (typeof payload === "string" || payload.type !== "access" || !payload.sub) {
    throw new ApiError(401, "UNAUTHORIZED", "The access token is invalid.");
  }

  return payload as AccessTokenPayload;
}

/** Verifies a refresh token before its server-side session is checked. */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "The refresh token is invalid or expired.");
  }

  if (
    typeof payload === "string" ||
    payload.type !== "refresh" ||
    !payload.sub ||
    typeof payload.sessionId !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new ApiError(401, "UNAUTHORIZED", "The refresh token is invalid.");
  }

  return payload as RefreshTokenPayload;
}

/** Produces a fixed-length digest so raw refresh tokens never enter MongoDB. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Compares token digests without leaking the first mismatching character through timing. */
export function tokenHashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
