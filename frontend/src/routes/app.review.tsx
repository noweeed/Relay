import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/relay/primitives";
import { ReviewTaskCard } from "@/components/relay/review-task-card";
import { useRelay } from "@/lib/relay-store";
import { toast } from "sonner";
import type { Candidate } from "@/lib/relay-data";

export const Route = createFileRoute("/app/review")({
  head: () => ({
    meta: [
      { title: "Review extracted tasks | Relay" },
      {
        name: "description",
        content: "Review the action items Relay found in a meeting before they reach the board.",
      },
      { property: "og:title", content: "Review extracted tasks | Relay" },
      {
        property: "og:description",
        content: "Approve, edit or reject extracted tasks with the quote in view.",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const {
    candidates,
    candidatesLoading,
    candidatesError,
    meetings,
    members,
    tasks,
    updateCandidate,
    approveCandidate,
    rejectCandidate,
    bulkApproveCandidates,
    bulkRejectCandidates,
    resolveDuplicate,
  } = useRelay();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<Candidate>>>({});

  const list = candidates.map((c) => ({ ...c, ...(edits[c.id] ?? {}) }));
  const pending = list.filter((c) => c.state === "pending" || c.state === "duplicate_pending");

  async function patch(id: string, p: Partial<Candidate>) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...p } }));
    try {
      await updateCandidate(id, p);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Candidate could not be updated");
    }
  }

  async function bulk(action: "approve" | "reject") {
    setBulkBusy(true);
    try {
      if (action === "approve") await bulkApproveCandidates(selected);
      else await bulkRejectCandidates(selected);
      toast.success(
        action === "approve"
          ? `${selected.length} tasks added to the board`
          : `${selected.length} tasks rejected`,
      );
      setSelected([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Candidates could not be reviewed");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Review extracted tasks"
        description={
          pending.length
            ? `Relay found ${list.length} possible action items. Review them before they're added to the board.`
            : "Everything from this meeting has been handled."
        }
      />

      {candidatesLoading ? (
        <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground md:px-8">
          <Loader2 className="size-4 animate-spin" /> Loading extracted tasks...
        </div>
      ) : candidatesError ? (
        <div className="px-6 py-8 text-sm text-destructive md:px-8">{candidatesError}</div>
      ) : pending.length === 0 ? (
        <div className="px-6 py-8 md:px-8">
          <EmptyState
            icon={ClipboardCheck}
            title="You're all caught up"
            description="There are no extracted tasks waiting for review."
            actions={
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/board" })}>
                Go to board
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3 md:px-8">
            <span className="text-[13px] text-muted-foreground">
              {selected.length} of {pending.length} selected
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                disabled={!selected.length || bulkBusy}
                onClick={() => bulk("approve")}
              >
                {bulkBusy ? <Loader2 className="size-4 animate-spin" /> : null} Approve selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selected.length || bulkBusy}
                onClick={() => bulk("reject")}
              >
                Reject selected
              </Button>
            </div>
          </div>

          <div className="space-y-3 px-6 py-6 md:px-8">
            {list.map((c) => (
              <ReviewTaskCard
                key={c.id}
                candidate={c}
                meeting={meetings.find((m) => m.id === c.meetingId)}
                members={members}
                existing={tasks.find((t) => t.id === c.duplicateOf?.taskId)}
                selected={selected.includes(c.id)}
                onSelect={(v) =>
                  setSelected((prev) => (v ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                }
                onApprove={async () => {
                  try {
                    await approveCandidate(c.id);
                    toast.success("Task added to the board");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Approval failed");
                  }
                }}
                onReject={async () => {
                  try {
                    await rejectCandidate(c.id);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Rejection failed");
                  }
                }}
                onEdit={(p) => void patch(c.id, p)}
                onResolveDuplicate={(action) => {
                  resolveDuplicate(c.id, action);
                  toast.success(
                    action === "update"
                      ? "Existing task updated with the new deadline"
                      : action === "separate"
                        ? "Kept as a separate task"
                        : "Candidate ignored",
                  );
                }}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
