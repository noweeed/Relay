import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import * as authService from "../services/auth.service";
import { ApiError } from "../utils/ApiError";
import type { LoginInput, SignupInput } from "../validators/auth.validator";

/** Builds the minimal device metadata stored with a refresh session for auditing. */
function getSessionMetadata(request: Request): authService.SessionMetadata {
  return {
    userAgent: request.get("user-agent"),
    ipAddress: request.ip
  };
}

/** Returns consistent secure-cookie settings for setting and clearing refresh tokens. */
function getRefreshCookieOptions(): CookieOptions {
  const production = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/api/auth"
  };
}

/** Stores the refresh token outside JavaScript while returning the access token in JSON. */
function sendAuthenticationResult(
  response: Response,
  result: authService.AuthenticationResult,
  statusCode: number
): void {
  response.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, {
    ...getRefreshCookieOptions(),
    maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1_000
  });
  response.status(statusCode).json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken }
  });
}

/** Registers a new user and starts their first refresh session. */
export async function signup(request: Request, response: Response): Promise<void> {
  const result = await authService.signup(request.body as SignupInput, getSessionMetadata(request));
  sendAuthenticationResult(response, result, 201);
}

/** Authenticates an existing user without disclosing which credential failed. */
export async function login(request: Request, response: Response): Promise<void> {
  const result = await authService.login(request.body as LoginInput, getSessionMetadata(request));
  sendAuthenticationResult(response, result, 200);
}

/** Rotates the HTTP-only refresh cookie and returns a new access token. */
export async function refresh(request: Request, response: Response): Promise<void> {
  const currentToken = request.cookies[env.REFRESH_COOKIE_NAME] as string | undefined;
  if (!currentToken) throw new ApiError(401, "UNAUTHORIZED", "A refresh token is required.");

  const result = await authService.refreshSession(currentToken, getSessionMetadata(request));
  sendAuthenticationResult(response, result, 200);
}

/** Revokes the current refresh session and removes its browser cookie. */
export async function logout(request: Request, response: Response): Promise<void> {
  const currentToken = request.cookies[env.REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(currentToken);
  response.clearCookie(env.REFRESH_COOKIE_NAME, getRefreshCookieOptions());
  response.json({ success: true, data: { loggedOut: true } });
}

/** Returns the public profile belonging to the authenticated access token. */
export async function me(request: Request, response: Response): Promise<void> {
  if (!request.user) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  const user = await authService.getCurrentUser(request.user.id);
  response.json({ success: true, data: user });
}
