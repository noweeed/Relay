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

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Relay" },
      {
        name: "description",
        content: "Create a Relay account to turn meeting recordings into reviewed, tracked tasks.",
      },
      { property: "og:title", content: "Create account | Relay" },
      { property: "og:description", content: "Set up a Relay workspace for your team." },
    ],
  }),
  component: SignupPage,
});

type Errors = {
  name?: string;
  email?: string;
  password?: string;
  form?: string;
};

function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const googleEnabled = !!import.meta.env["VITE_GOOGLE_CLIENT_ID"];

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (values.name.trim().length < 2) next.name = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = "Enter a valid email address.";
    if (values.password.length < 12) next.password = "Use at least 12 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await signup(values.name.trim(), values.email, values.password);
      navigate({ to: "/app/new-project" });
    } catch (error) {
      setErrors({ form: apiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { id: "name", label: "Name", type: "text", autoComplete: "name" },
    { id: "email", label: "Email", type: "email", autoComplete: "email" },
    { id: "password", label: "Password", type: "password", autoComplete: "new-password" },
  ] as const;

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
          <h1 className="text-[20px] font-semibold">Create account</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Set up your Relay workspace.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {fields.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label htmlFor={f.id}>{f.label}</Label>
                <Input
                  id={f.id}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  value={values[f.id]}
                  onChange={set(f.id)}
                  aria-invalid={!!errors[f.id]}
                  aria-describedby={errors[f.id] ? `${f.id}-error` : undefined}
                  className="bg-transparent"
                />
                {errors[f.id] ? (
                  <p id={`${f.id}-error`} className="text-[12.5px] text-destructive">
                    {errors[f.id]}
                  </p>
                ) : null}
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Creating account...
                </>
              ) : (
                "Create account"
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
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
