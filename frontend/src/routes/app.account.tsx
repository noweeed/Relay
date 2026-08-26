import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/relay/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiErrorMessage, type NotificationPreferences } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/app/account")({
  head: () => ({
    meta: [
      { title: "Account settings | Relay" },
      { name: "description", content: "Manage your Relay profile, security and notifications." },
    ],
  }),
  component: AccountPage,
});

const preferenceRows: Array<{
  id: keyof Omit<NotificationPreferences, "emailNotifications" | "inAppNotifications">;
  label: string;
  hint: string;
}> = [
  {
    id: "upcomingDeadlines",
    label: "Upcoming deadlines",
    hint: "A day before a task assigned to you is due.",
  },
  { id: "overdueTasks", label: "Overdue tasks", hint: "When a task passes its deadline." },
  {
    id: "meetingProcessing",
    label: "Meeting processing completed",
    hint: "When a meeting finishes processing.",
  },
  {
    id: "reviewQueue",
    label: "Tasks requiring review",
    hint: "When extracted tasks are waiting for approval.",
  },
  {
    id: "mentionsAndAssignments",
    label: "Mentions and assignments",
    hint: "When someone assigns a task to you.",
  },
  { id: "weeklyDigest", label: "Weekly digest", hint: "A Monday summary of your recent work." },
];

/** Wraps one account settings group in the same compact card rhythm as project settings. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

/** Resizes a selected image to a small browser-safe avatar before API persistence. */
async function resizeAvatar(file: File): Promise<string> {
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 200 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize the selected image.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  return canvas.toDataURL("image/webp", 0.82);
}

/** Changes the password through the authenticated credential-rotation endpoint. */
function PasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { changePassword } = useAuth();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Validates confirmation locally before asking the backend to verify the old password. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.current || values.next.length < 12 || values.next !== values.confirm) {
      setError("Enter your current password, use 12+ new characters, and confirm them exactly.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changePassword(values.current, values.next);
      setValues({ current: "", next: "", confirm: "" });
      onOpenChange(false);
      toast.success("Password updated");
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>All older refresh sessions will be revoked.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {(["current", "next", "confirm"] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={`password-${field}`}>
                {field === "current"
                  ? "Current password"
                  : field === "next"
                    ? "New password"
                    : "Confirm new password"}
              </Label>
              <Input
                id={`password-${field}`}
                type="password"
                value={values[field]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field]: event.target.value }))
                }
                autoComplete={field === "current" ? "current-password" : "new-password"}
              />
            </div>
          ))}
          {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Confirms irreversible account deletion and supplies a password when the account has one. */
function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Deletes the account only after the explicit phrase and backend ownership checks pass. */
  async function confirmDeletion() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(user?.hasPassword ? password : undefined);
      onOpenChange(false);
      await navigate({ to: "/", replace: true });
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            Transfer every project you own first. This removes your login and memberships
            permanently.
          </DialogDescription>
        </DialogHeader>
        {user?.hasPassword ? (
          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Current password</Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="delete-phrase">Type delete my account</Label>
          <Input
            id="delete-phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
          />
        </div>
        {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={
              deleting ||
              phrase.trim().toLowerCase() !== "delete my account" ||
              (!!user?.hasPassword && !password)
            }
            onClick={() => void confirmDeletion()}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{" "}
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Presents the authenticated user's real profile, security, and notification settings. */
function AccountPage() {
  const { user, updateProfile, updateNotificationPreferences } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => setName(user?.name ?? ""), [user?.name]);

  if (!user) return null;
  const authenticatedUser = user;

  /** Persists the editable display name while email remains the verified login identity. */
  async function saveName() {
    if (name.trim().length < 2) {
      toast.error("Name must contain at least two characters");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      toast.success("Profile updated");
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  /** Resizes and saves a user-selected avatar without keeping the original large file. */
  async function uploadAvatar(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Choose an image under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const avatarUrl = await resizeAvatar(file);
      await updateProfile({ avatarUrl });
      toast.success("Profile picture updated");
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setUploading(false);
    }
  }

  /** Optimistically toggles one preference and rolls back if persistence fails. */
  async function setPreference(key: keyof NotificationPreferences, enabled: boolean) {
    const next = { ...authenticatedUser.notificationPreferences, [key]: enabled };
    try {
      await updateNotificationPreferences(next);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    }
  }

  return (
    <>
      <PageHeader
        title="Account settings"
        description="Your profile, security and notification preferences."
      />
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-6 md:px-8">
        <Section title="Profile">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Profile"
                  className="size-12 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-full bg-secondary font-medium">
                  {user.name[0]?.toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-[13.5px] font-medium">Profile picture</p>
                <p className="meta-text">PNG, JPG or WebP; resized to a maximum of 200px.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}{" "}
                  Upload new
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="account-name">Name</Label>
                <Input
                  id="account-name"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-email">Email</Label>
                <Input id="account-email" value={user.email} readOnly />
              </div>
            </div>
            <Button size="sm" className="mt-4" disabled={saving} onClick={() => void saveName()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save changes
            </Button>
          </div>
        </Section>

        <Section title="Security">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-[13.5px] font-medium">Password</p>
              <p className="meta-text">
                {user.hasPassword
                  ? "Use a strong password unique to Relay."
                  : "This account currently signs in with Google."}
              </p>
            </div>
            {user.hasPassword ? (
              <Button size="sm" variant="outline" onClick={() => setPasswordOpen(true)}>
                Change password
              </Button>
            ) : null}
          </div>
        </Section>

        <Section title="Notifications">
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {preferenceRows.map((row) => (
              <div key={row.id} className="flex items-center gap-4 px-4 py-3">
                <Label
                  htmlFor={`preference-${row.id}`}
                  className="flex flex-1 cursor-pointer flex-col items-start gap-0.5"
                >
                  <span>{row.label}</span>
                  <span className="meta-text font-normal">{row.hint}</span>
                </Label>
                <Switch
                  id={`preference-${row.id}`}
                  checked={user.notificationPreferences[row.id]}
                  onCheckedChange={(value) => void setPreference(row.id, value)}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["emailNotifications", "Email notifications"],
                ["inAppNotifications", "In-app notifications"],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <Label htmlFor={key} className="flex-1">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={user.notificationPreferences[key]}
                  onCheckedChange={(value) => void setPreference(key, value)}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Danger zone">
          <div className="flex items-center gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex-1">
              <p className="text-[13.5px] font-medium">Delete account</p>
              <p className="meta-text">
                Permanently remove your profile after transferring owned projects.
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete account
            </Button>
          </div>
        </Section>
      </div>
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
