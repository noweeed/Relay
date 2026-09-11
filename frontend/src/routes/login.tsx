import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/relay/google-sign-in-button";
import { RelayBrand } from "@/components/relay/relay-brand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Relay" },
      {
        name: "description",
        content: "Sign in to Relay to review extracted tasks and track your project board.",
      },
      { property: "og:title", content: "Sign in | Relay" },
      { property: "og:description", content: "Access your Relay workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const googleEnabled = !!import.meta.env["VITE_GOOGLE_CLIENT_ID"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await login(email, password);
      navigate({ to: "/app" });
    } catch (error) {
      setErrors({ form: apiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          aria-label="Go to Relay homepage"
          className="mx-auto mb-6 flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <RelayBrand />
        </Link>
        <div className="rounded-xl border border-border bg-card p-8">
          <h1 className="text-[20px] font-semibold">Sign in</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Welcome back to Relay.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className="bg-transparent"
              />
              {errors.email ? (
                <p id="email-error" className="text-[12.5px] text-destructive">
                  {errors.email}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                className="bg-transparent"
              />
              {errors.password ? (
                <p id="password-error" className="text-[12.5px] text-destructive">
                  {errors.password}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
            {errors.form ? <p className="text-[12.5px] text-destructive">{errors.form}</p> : null}
          </form>
          {googleEnabled ? (
            <>
              <div className="my-5 flex items-center gap-3 text-[12px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> OR CONTINUE WITH
                <span className="h-px flex-1 bg-border" />
              </div>
              <GoogleSignInButton onSuccess={() => navigate({ to: "/app" })} />
            </>
          ) : null}
        </div>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          No account?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}
