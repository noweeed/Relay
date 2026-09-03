import { useState } from "react";
import { Check, Loader2, Mic, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  formatDate,
  priorityLabel,
  type Candidate,
  type Member,
  type Meeting,
  type Priority,
  type Task,
} from "@/lib/relay-data";
import { Tag } from "./primitives";

export function DuplicateNotice({
  candidate,
  existing,
  onResolve,
}: {
  candidate: Candidate;
  existing: Task;
  onResolve: (action: "update" | "separate" | "ignore") => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-warning/40 bg-warning/8 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold">Possible existing task</span>
        <Tag tone="warning">
          {candidate.duplicateOf?.confidence === "high" ? "High confidence" : "Worth checking"}
        </Tag>
      </div>
      <dl className="mt-2.5 grid gap-1.5 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="meta-text">Candidate</dt>
          <dd>{candidate.title}</dd>
          <dd className="meta-text">Meeting suggests {formatDate(candidate.due)}</dd>
        </div>
        <div>
          <dt className="meta-text">Existing task</dt>
          <dd>{existing.title}</dd>
          <dd className="meta-text">Existing deadline {formatDate(existing.due)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onResolve("update")}>
          Update existing
        </Button>
        <Button size="sm" variant="outline" onClick={() => onResolve("separate")}>
          Create separate task
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onResolve("ignore")}>
          Ignore candidate
        </Button>
      </div>
    </div>
  );
}

export function ReviewTaskCard({
  candidate,
  meeting,
  existing,
  selected,
  onSelect,
  onApprove,
  onReject,
  onEdit,
  onResolveDuplicate,
  members,
}: {
  candidate: Candidate;
  meeting?: Meeting | undefined;
  existing?: Task | undefined;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onApprove: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
  onEdit: (patch: Partial<Candidate>) => void;
  onResolveDuplicate: (action: "update" | "separate" | "ignore") => void;
  members: Member[];
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const approved = candidate.state === "approved";
  const rejected = candidate.state === "rejected";

  async function approve() {
    setBusy(true);
    try {
      await onApprove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        approved && "border-success/40 bg-success/5",
        rejected && "border-border bg-secondary/50 opacity-70",
        !approved && !rejected && "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelect(!!v)}
          disabled={approved || rejected}
          aria-label={`Select ${candidate.title}`}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-[14.5px] font-medium", rejected && "line-through")}>
              {candidate.title}
            </h3>
            {approved ? <Tag tone="success">Approved</Tag> : null}
            {rejected ? <Tag tone="neutral">Rejected</Tag> : null}
          </div>

          {editing ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Assignee</Label>
                <Select
                  value={candidate.assigneeId ?? "none"}
                  onValueChange={(v) => onEdit({ assigneeId: v === "none" ? null : v })}
                >
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Deadline</Label>
                <Input
                  type="date"
                  className="h-8 text-[13px]"
                  value={candidate.due ?? ""}
                  onChange={(e) => onEdit({ due: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Priority</Label>
                <Select
                  value={candidate.priority}
                  onValueChange={(v) => onEdit({ priority: v as Priority })}
                >
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["high", "medium", "low"] as Priority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {priorityLabel[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <dt className="meta-text">Assignee</dt>
                <dd className="text-[13.5px]">
                  {members.find((member) => member.id === candidate.assigneeId)?.name ??
                    "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="meta-text">Deadline</dt>
                <dd className="text-[13.5px]">{formatDate(candidate.due)}</dd>
              </div>
              <div>
                <dt className="meta-text">Priority</dt>
                <dd className="text-[13.5px]">{priorityLabel[candidate.priority]}</dd>
              </div>
            </dl>
          )}

          <div className="mt-3 rounded-lg border border-border bg-secondary/60 p-3">
            <p className="flex items-center gap-1.5 text-[12.5px] text-subtle">
              <Mic className="size-3.5" />
              {meeting?.title ?? "Meeting"} · {candidate.timestamp}
            </p>
            <blockquote className="mt-1.5 border-l-2 border-border-strong pl-3 text-[13px] italic text-muted-foreground">
              &ldquo;{candidate.quote}&rdquo;
            </blockquote>
          </div>

          {candidate.duplicateOf && existing && !approved && !rejected ? (
            <DuplicateNotice
              candidate={candidate}
              existing={existing}
              onResolve={onResolveDuplicate}
            />
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {approved ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-success">
                <Check className="size-4" /> Added to the board
              </span>
            ) : rejected ? (
              <span className="text-[13px] text-muted-foreground">Kept for review history</span>
            ) : (
              <>
                <Button size="sm" onClick={approve} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Approving...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" /> Approve
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
                  <Pencil className="size-4" /> {editing ? "Done editing" : "Edit"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onReject()}>
                  <X className="size-4" /> Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
