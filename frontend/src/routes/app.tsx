import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/relay/app-shell";
import { useAuth } from "@/lib/auth-store";
import { RelayProvider } from "@/lib/relay-store";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "anonymous") navigate({ to: "/login", replace: true });
  }, [navigate, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading Relay…
      </div>
    );
  }
  if (status === "anonymous") return null;

  return (
    <RelayProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </RelayProvider>
  );
}
