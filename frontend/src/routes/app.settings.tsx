import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Tag, UserAvatar } from "@/components/relay/primitives";
import { apiErrorMessage } from "@/lib/api-client";
import { type Member } from "@/lib/relay-data";
import { useRelay } from "@/lib/relay-store";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Project settings | Relay" },
      {
        name: "description",
        content: "Rename the project, manage members, and connect Telegram for deadline reminders.",
      },
      { property: "og:title", content: "Project settings | Relay" },
      {
        property: "og:description",
        content: "Manage your Relay project, its members and integrations.",
      },
    ],
  }),
  component: SettingsPage,
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border pb-8 last:border-0">
      <h2 className="section-title">{title}</h2>
      {description ? (
        <p className="mt-1 text-[13.5px] text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { inviteProjectMember } = useRelay();
  const [email, setEmail] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Invite member</DialogTitle>
          <DialogDescription className="text-[13.5px]">
            They'll get access to this project's meetings and board.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^\S+@\S+\.\S+$/.test(email)) {
              setError("Enter a valid email address.");
              return;
            }
            if (teamRole.trim().length < 2 || teamRole.trim().length > 60) {
              setError("Team role must contain 2–60 characters.");
              return;
            }
            setError(null);
            setSending(true);
            try {
              await inviteProjectMember(email.trim(), teamRole.trim());
              setEmail("");
              setTeamRole("");
              onOpenChange(false);
              toast.success("Member added");
            } catch (requestError) {
              setError(apiErrorMessage(requestError));
            } finally {
              setSending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              aria-invalid={!!error}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-team-role">Team role</Label>
            <Input
              id="invite-team-role"
              maxLength={60}
              value={teamRole}
              onChange={(e) => setTeamRole(e.target.value)}
              placeholder="Frontend engineer"
              aria-invalid={!!error}
            />
            <p className="text-[12px] text-muted-foreground">
              This is a descriptive title, not an admin permission.
            </p>
          </div>
          {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Adding...
                </>
              ) : (
                "Add member"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Edits the member's descriptive team role without touching access permissions. */
function EditTeamRoleDialog({
  member,
  onOpenChange,
}: {
  member: Member | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateProjectMemberTeamRole } = useRelay();
  const [teamRole, setTeamRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTeamRole(member?.role ?? "");
    setError(null);
  }, [member]);

  /** Saves the free-text title through the owner/admin-only member endpoint. */
  async function saveTeamRole() {
    if (!member) return;
    const trimmedRole = teamRole.trim();
    if (trimmedRole.length < 2 || trimmedRole.length > 60) {
      setError("Team role must contain 2–60 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProjectMemberTeamRole(member.id, trimmedRole);
      onOpenChange(false);
      toast.success("Team role updated");
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Edit team role</DialogTitle>
          <DialogDescription className="text-[13.5px]">
            Change the title shown for {member?.name}. Their {member?.accessRole ?? "member"} access
            will not change.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="edit-team-role">Team role</Label>
          <Input
            id="edit-team-role"
            value={teamRole}
            onChange={(event) => setTeamRole(event.target.value)}
            maxLength={60}
            placeholder="Frontend engineer"
            aria-invalid={!!error}
          />
          {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void saveTeamRole()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Requires an explicit existing-member selection before an irreversible ownership transfer. */
function TransferOwnershipDialog({
  open,
  onOpenChange,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
}) {
  const { transferProjectOwnership } = useRelay();
  const [targetUserId, setTargetUserId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Calls the owner-only transfer after the recipient is chosen from verified members. */
  async function transfer() {
    if (!targetUserId) return setError("Choose the new project owner.");
    setTransferring(true);
    setError(null);
    try {
      await transferProjectOwnership(targetUserId);
      onOpenChange(false);
      toast.success("Project ownership transferred");
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setTransferring(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer project ownership</DialogTitle>
          <DialogDescription>
            The selected member becomes owner. You remain in the project as an admin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New owner</Label>
          <Select value={targetUserId} onValueChange={setTargetUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a project member" />
            </SelectTrigger>
            <SelectContent>
              {members
                .filter((member) => member.accessRole !== "owner")
                .map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} — {member.role}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-[12px] text-muted-foreground">
            Only existing members are listed, preventing transfer to the wrong email address.
          </p>
        </div>
        {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!targetUserId || transferring} onClick={() => void transfer()}>
            {transferring ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="size-4" />
            )}
            Transfer ownership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Renders project configuration using real member data and membership actions. */
function SettingsPage() {
  const { activeProject, members } = useRelay();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState(activeProject?.name ?? "");
  const [description, setDescription] = useState(activeProject?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [telegram, setTelegram] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const canManageMembers = activeProject?.role === "owner" || activeProject?.role === "admin";

  async function save() {
    if (projectName.trim().length < 2) {
      setError("Give the project a name your team will recognize.");
      return;
    }
    setError(null);
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success("Project updated");
  }

  return (
    <>
      <PageHeader
        title="Project settings"
        description="Details, members and integrations for this project."
      />

      <div className="max-w-2xl space-y-8 px-6 py-6 md:px-8">
        <Section title="Details">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-project">Project name</Label>
              <Input
                id="s-project"
                value={projectName}
                maxLength={80}
                onChange={(e) => setProjectName(e.target.value)}
                aria-invalid={!!error}
              />
              {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-desc">Description</Label>
              <Textarea
                id="s-desc"
                rows={3}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this team is working on."
              />
            </div>
          </div>
          <Button size="sm" className="mt-4" onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </Section>

        <Section
          title="Members"
          description="Everyone here can review extracted tasks and edit the board."
        >
          {canManageMembers ? (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                <Plus className="size-4" /> Add member
              </Button>
            </div>
          ) : null}
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar memberId={m.id} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{m.name}</span>
                  <span className="meta-text">{m.email}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[13px] text-muted-foreground">{m.role}</span>
                  <Tag tone="neutral">{m.accessRole ?? "member"}</Tag>
                </span>
                {canManageMembers ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${m.name}'s team role`}
                    onClick={() => setEditingMember(m)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Telegram"
          description="Send this project's deadline reminders where the team already talks."
        >
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <Send className="size-4 text-muted-foreground" />
            <span className="text-[13.5px] font-medium">Telegram</span>
            {telegram ? (
              <Tag tone="success">Connected</Tag>
            ) : (
              <Tag tone="neutral">Not connected</Tag>
            )}
            <div className="ml-auto">
              {telegram ? (
                <Button size="sm" variant="outline" onClick={() => setTelegram(false)}>
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" onClick={() => setTelegram(true)}>
                  Connect Telegram
                </Button>
              )}
            </div>
          </div>
        </Section>

        <Section title="Danger zone">
          {activeProject?.role === "owner" ? (
            <div className="mb-3 flex flex-wrap items-center gap-4 rounded-xl border border-warning/40 bg-warning/5 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium">Transfer ownership</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Give ownership to an existing project member. You will become an admin.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="size-4" /> Transfer
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">Delete project</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Removes this project's meetings, transcripts and tasks for everyone.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete project
            </Button>
          </div>
        </Section>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditTeamRoleDialog
        member={editingMember}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
      />
      <TransferOwnershipDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        members={members}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Delete project</DialogTitle>
            <DialogDescription className="text-[13.5px]">
              This can't be undone. Type the project name to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-project">
              Type <span className="font-mono text-foreground">{activeProject?.name}</span>
            </Label>
            <Input
              id="confirm-project"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmName.trim() !== activeProject?.name}
              onClick={() => {
                setDeleteOpen(false);
                toast.success("Project deleted");
                navigate({ to: "/app/new-project" });
              }}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
