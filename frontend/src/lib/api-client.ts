/** Public user shape returned by Relay's authentication endpoints. */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  hasPassword: boolean;
  notificationPreferences: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreferences = {
  upcomingDeadlines: boolean;
  overdueTasks: boolean;
  meetingProcessing: boolean;
  reviewQueue: boolean;
  mentionsAndAssignments: boolean;
  weeklyDigest: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
};

export type AuthPayload = { user: AuthUser; accessToken: string };

type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; fields?: Record<string, string> };
};

type ApiSuccessBody<T> = { success: true; data: T };

/** An HTTP error whose safe message came directly from the Relay API. */
export class RelayApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "RelayApiError";
  }
}

const apiBaseUrl = (import.meta.env["VITE_API_URL"] ?? "http://localhost:5000/api").replace(
  /\/$/,
  "",
);
let accessToken: string | null = null;
let refreshPromise: Promise<AuthPayload> | null = null;

/** Keeps the short-lived access token in memory instead of browser storage. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Exposes the in-memory token only to trusted same-page transports such as Socket.IO. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Reads Relay's standard success/error envelope and preserves safe backend messages. */
async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiSuccessBody<T> | ApiErrorBody | null;
  if (!response.ok || !body || body.success === false) {
    const error = body && body.success === false ? body.error : undefined;
    throw new RelayApiError(
      response.status,
      error?.code ?? "NETWORK_ERROR",
      error?.message ?? "Relay could not complete the request.",
      error?.fields,
    );
  }
  return body.data;
}

/** Rotates the HTTP-only refresh cookie and restores an in-memory access token. */
export async function refreshAccessToken(): Promise<AuthPayload> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(readResponse<AuthPayload>)
      .then((payload) => {
        setAccessToken(payload.accessToken);
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Calls the Relay API and retries one expired access token through the refresh cookie. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retryAfterRefresh && !path.startsWith("/auth/")) {
    await refreshAccessToken();
    return apiRequest<T>(path, init, false);
  }
  return readResponse<T>(response);
}

/** Returns a friendly message for UI forms without exposing raw implementation errors. */
export function apiErrorMessage(error: unknown): string {
  return error instanceof RelayApiError ? error.message : "Could not reach the Relay API.";
}
