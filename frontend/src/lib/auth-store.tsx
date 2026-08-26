import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiRequest,
  refreshAccessToken,
  setAccessToken,
  type AuthPayload,
  type AuthUser,
  type NotificationPreferences,
} from "./api-client";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  authenticateWithGoogle: (credential: string) => Promise<void>;
  updateProfile: (input: { name?: string; avatarUrl?: string | null }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateNotificationPreferences: (preferences: NotificationPreferences) => Promise<void>;
  deleteAccount: (currentPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Owns the browser session while keeping the access JWT only in application memory. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let active = true;

    /** Restores a page reload using the secure HTTP-only refresh cookie. */
    async function restoreSession() {
      try {
        const payload = await refreshAccessToken();
        if (active) {
          setUser(payload.user);
          setStatus("authenticated");
        }
      } catch {
        setAccessToken(null);
        if (active) setStatus("anonymous");
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const acceptAuthentication = useCallback((payload: AuthPayload) => {
    setAccessToken(payload.accessToken);
    setUser(payload.user);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await apiRequest<AuthPayload>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
        false,
      );
      acceptAuthentication(payload);
    },
    [acceptAuthentication],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const payload = await apiRequest<AuthPayload>(
        "/auth/signup",
        { method: "POST", body: JSON.stringify({ name, email, password }) },
        false,
      );
      acceptAuthentication(payload);
    },
    [acceptAuthentication],
  );

  const authenticateWithGoogle = useCallback(
    async (credential: string) => {
      const payload = await apiRequest<AuthPayload>(
        "/auth/google",
        { method: "POST", body: JSON.stringify({ credential }) },
        false,
      );
      acceptAuthentication(payload);
    },
    [acceptAuthentication],
  );

  const updateProfile = useCallback(async (input: { name?: string; avatarUrl?: string | null }) => {
    const updated = await apiRequest<AuthUser>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    setUser(updated);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const payload = await apiRequest<AuthPayload>("/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      acceptAuthentication(payload);
    },
    [acceptAuthentication],
  );

  const updateNotificationPreferences = useCallback(
    async (preferences: NotificationPreferences) => {
      const updated = await apiRequest<AuthUser>("/auth/me/notifications", {
        method: "PUT",
        body: JSON.stringify(preferences),
      });
      setUser(updated);
    },
    [],
  );

  const deleteAccount = useCallback(async (currentPassword?: string) => {
    await apiRequest<{ deleted: boolean }>("/auth/me", {
      method: "DELETE",
      body: JSON.stringify(currentPassword ? { currentPassword } : {}),
    });
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ loggedOut: boolean }>("/auth/logout", { method: "POST" }, false);
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      signup,
      authenticateWithGoogle,
      updateProfile,
      changePassword,
      updateNotificationPreferences,
      deleteAccount,
      logout,
    }),
    [
      user,
      status,
      login,
      signup,
      authenticateWithGoogle,
      updateProfile,
      changePassword,
      updateNotificationPreferences,
      deleteAccount,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Returns the authenticated session context and guards against a missing provider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
