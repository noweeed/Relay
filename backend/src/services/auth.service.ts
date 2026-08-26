import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { env } from "../config/env";
import { RefreshSession } from "../models/RefreshSession.model";
import { User, type UserDocument } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  tokenHashesMatch,
  verifyRefreshToken
} from "../utils/tokens";
import type { LoginInput, SignupInput } from "../validators/auth.validator";

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticationResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

/** Converts a database user into the only user shape allowed in API responses. */
export function serializeUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

/** Creates a revocable refresh session and its matching access token pair. */
async function createSession(
  user: UserDocument,
  metadata: SessionMetadata
): Promise<AuthenticationResult> {
  const sessionId = new Types.ObjectId();
  const refreshToken = signRefreshToken(user._id.toString(), sessionId.toString());
  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1_000
  );

  await RefreshSession.create({
    _id: sessionId,
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress
  });

  return {
    user: serializeUser(user),
    accessToken: signAccessToken(user._id.toString()),
    refreshToken
  };
}

/** Registers a user and immediately creates their first authenticated session. */
export async function signup(
  input: SignupInput,
  metadata: SessionMetadata
): Promise<AuthenticationResult> {
  if (Buffer.byteLength(input.password, "utf8") > 72) {
    throw new ApiError(400, "VALIDATION_ERROR", "Password must be at most 72 UTF-8 bytes.");
  }

  const existingUser = await User.exists({ email: input.email });
  if (existingUser) {
    throw new ApiError(409, "CONFLICT", "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const user = await User.create({ name: input.name, email: input.email, passwordHash });
  return createSession(user, metadata);
}

/** Validates credentials without revealing whether the email or password was incorrect. */
export async function login(
  input: LoginInput,
  metadata: SessionMetadata
): Promise<AuthenticationResult> {
  if (Buffer.byteLength(input.password, "utf8") > 72) {
    throw new ApiError(401, "UNAUTHORIZED", "Email or password is incorrect.");
  }

  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

  if (!user || !passwordMatches) {
    throw new ApiError(401, "UNAUTHORIZED", "Email or password is incorrect.");
  }

  return createSession(user, metadata);
}

/** Atomically rotates a valid refresh token so the previous token becomes unusable. */
export async function refreshSession(
  currentToken: string,
  metadata: SessionMetadata
): Promise<AuthenticationResult> {
  const payload = verifyRefreshToken(currentToken);
  const currentHash = hashToken(currentToken);
  const session = await RefreshSession.findOne({
    _id: payload.sessionId,
    userId: payload.sub,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  }).select("+tokenHash");

  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "The refresh session is invalid or expired.");
  }

  if (!tokenHashesMatch(session.tokenHash, currentHash)) {
    await RefreshSession.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });
    throw new ApiError(401, "UNAUTHORIZED", "Refresh token reuse was detected.");
  }

  const nextToken = signRefreshToken(payload.sub, payload.sessionId);
  const rotated = await RefreshSession.findOneAndUpdate(
    { _id: session._id, tokenHash: currentHash, revokedAt: { $exists: false } },
    {
      $set: {
        tokenHash: hashToken(nextToken),
        rotatedAt: new Date(),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress
      }
    },
    { returnDocument: "after" }
  );

  if (!rotated) {
    throw new ApiError(401, "UNAUTHORIZED", "The refresh token has already been used.");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    await RefreshSession.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });
    throw new ApiError(401, "UNAUTHORIZED", "The authenticated user no longer exists.");
  }

  return {
    user: serializeUser(user),
    accessToken: signAccessToken(user._id.toString()),
    refreshToken: nextToken
  };
}

/** Revokes the refresh session when possible; malformed tokens still result in a cleared cookie. */
export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;

  try {
    const payload = verifyRefreshToken(refreshToken);
    await RefreshSession.updateOne(
      { _id: payload.sessionId, userId: payload.sub },
      { $set: { revokedAt: new Date() } }
    );
  } catch {
    // Logout is intentionally idempotent and must not preserve a bad client cookie.
  }
}

/** Loads the authenticated user's public profile. */
export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "NOT_FOUND", "User was not found.");
  return serializeUser(user);
}
