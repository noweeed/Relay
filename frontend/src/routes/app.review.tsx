import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/relay/primitives";
import { ReviewTaskCard } from "@/components/relay/review-task-card";
import { useRelay } from "@/lib/relay-store";
import { toast } from "sonner";
import type { Candidate } from "@/lib/relay-data";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/app/review")({
  head: () => ({
    meta: [
      { title: "Relay" },
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

type StatusFilter = "needs_review" | "all" | "approved" | "rejected";

function ReviewPage() {
  const {
    candidates,
    candidatesLoading,
    candidatesError,
    meetings,
    members,
    tasks,
    activeProject,
    updateCandidate,
    approveCandidate,
    rejectCandidate,
    restoreCandidate,
    deleteCandidate,
    bulkApproveCandidates,
    bulkRejectCandidates,
    resolveDuplicate,
  } = useRelay();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<Candidate>>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("needs_review");
  const [meetingFilter, setMeetingFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const list = candidates.map((candidate) => ({
    ...candidate,
    ...(edits[candidate.id] ?? {}),
  }));
  const pending = list.filter(
    (candidate) => candidate.state === "pending" || candidate.state === "duplicate_pending",
  );
  const filtered = list.filter((candidate) => {
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "needs_review"
        ? candidate.state === "pending" || candidate.state === "duplicate_pending"
        : candidate.state === statusFilter);
    return statusMatches && (meetingFilter === "all" || candidate.meetingId === meetingFilter);
  });
  const selectableIds = filtered
    .filter((candidate) => candidate.state === "pending")
    .map((candidate) => candidate.id);
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));
  const groups = useMemo(() => {
    const byMeeting = new Map<string, Candidate[]>();
    for (const candidate of filtered) {
      byMeeting.set(candidate.meetingId, [
        ...(byMeeting.get(candidate.meetingId) ?? []),
        candidate,
      ]);
    }
    return [...byMeeting.entries()];
  }, [filtered]);

  async function patch(id: string, candidatePatch: Partial<Candidate>) {
    setEdits((previous) => ({
      ...previous,
      [id]: { ...(previous[id] ?? {}), ...candidatePatch },
    }));
    try {
      await updateCandidate(id, candidatePatch);
      setEdits((previous) => {
        const next = { ...previous };
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

  async function removeFromHistory() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCandidate(deleteTarget.id);
      toast.success("Removed from review history");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review item could not be removed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Review extracted tasks"
        description={
          pending.length
            ? `${pending.length} action ${pending.length === 1 ? "item needs" : "items need"} your review.`
            : "Everything has been handled. You can view past decisions in review history."
        }
      />

      {candidatesLoading ? (
        <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground md:px-8">
          <Loader2 className="size-4 animate-spin" /> Loading extracted tasks...
        </div>
      ) : candidatesError ? (
        <div className="px-6 py-8 text-sm text-destructive md:px-8">{candidatesError}</div>
      ) : list.length === 0 ? (
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
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as StatusFilter);
                setSelected([]);
              }}
            >
              <SelectTrigger className="h-8 w-40 text-[13px]" aria-label="Filter by review status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needs_review">Needs review</SelectItem>
                <SelectItem value="all">All tasks</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={meetingFilter}
              onValueChange={(value) => {
                setMeetingFilter(value);
                setSelected([]);
              }}
            >
              <SelectTrigger className="h-8 w-48 text-[13px]" aria-label="Filter by meeting">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All meetings</SelectItem>
                {meetings.map((meeting) => (
                  <SelectItem key={meeting.id} value={meeting.id}>
                    {meeting.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectableIds.length > 0 ? (
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) =>
                    setSelected((previous) =>
                      checked
                        ? [...new Set([...previous, ...selectableIds])]
                        : previous.filter((id) => !selectableIds.includes(id)),
                    )
                  }
                  aria-label="Select all visible tasks"
                />
                Select all
              </label>
            ) : null}
            <span className="text-[13px] text-muted-foreground">{selected.length} selected</span>
            <Button
              size="sm"
              disabled={!selected.length || bulkBusy}
              onClick={() => void bulk("approve")}
            >
              {bulkBusy ? <Loader2 className="size-4 animate-spin" /> : null} Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected.length || bulkBusy}
              onClick={() => void bulk("reject")}
            >
              Reject
            </Button>
          </div>

          {groups.length === 0 ? (
            <div className="px-6 py-8 md:px-8">
              <EmptyState
                icon={ClipboardCheck}
                title={statusFilter === "needs_review" ? "You're all caught up" : "No matches"}
                description={
                  statusFilter === "needs_review"
                    ? "There are no extracted tasks waiting for review."
                    : "No review tasks match these filters."
                }
                actions={
                  statusFilter === "needs_review" ? (
                    <Button size="sm" variant="outline" onClick={() => setStatusFilter("all")}>
                      View history
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setStatusFilter("all");
                        setMeetingFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="space-y-7 px-6 py-6 md:px-8">
              {groups.map(([meetingId, group]) => {
                const meeting = meetings.find((item) => item.id === meetingId);
                return (
                  <section key={meetingId} aria-labelledby={`meeting-${meetingId}`}>
                    <div className="mb-3 flex items-center gap-2">
                      <h2 id={`meeting-${meetingId}`} className="text-[14px] font-semibold">
                        {meeting?.title ?? "Meeting"}
                      </h2>
                      <span className="text-[12px] text-subtle">
                        {group.length} {group.length === 1 ? "task" : "tasks"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.map((candidate) => (
                        <ReviewTaskCard
                          key={candidate.id}
                          candidate={candidate}
                          meeting={meeting}
                          members={members}
                          existing={tasks.find((task) => task.id === candidate.duplicateOf?.taskId)}
                          canUpdateExisting={(() => {
                            const existing = tasks.find(
                              (task) => task.id === candidate.duplicateOf?.taskId,
                            );
                            const assigneeIds =
                              existing?.assigneeIds ??
                              (existing?.assigneeId ? [existing.assigneeId] : []);
                            return (
                              activeProject?.role === "owner" ||
                              activeProject?.role === "admin" ||
                              Boolean(user && assigneeIds.includes(user.id))
                            );
                          })()}
                          selected={selected.includes(candidate.id)}
                          onSelect={(checked) =>
                            setSelected((previous) =>
                              checked
                                ? [...new Set([...previous, candidate.id])]
                                : previous.filter((id) => id !== candidate.id),
                            )
                          }
                          onApprove={async () => {
                            try {
                              await approveCandidate(candidate.id);
                              setSelected((previous) =>
                                previous.filter((id) => id !== candidate.id),
                              );
                              toast.success("Task added to the board");
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Approval failed",
                              );
                            }
                          }}
                          onReject={async () => {
                            try {
                              await rejectCandidate(candidate.id);
                              setSelected((previous) =>
                                previous.filter((id) => id !== candidate.id),
                              );
                              toast.success("Task rejected");
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Rejection failed",
                              );
                            }
                          }}
                          onRestore={async () => {
                            try {
                              await restoreCandidate(candidate.id);
                              toast.success("Task restored to review");
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Restore failed",
                              );
                            }
                          }}
                          onDelete={() => setDeleteTarget(candidate)}
                          onEdit={(candidatePatch) => void patch(candidate.id, candidatePatch)}
                          onResolveDuplicate={async (action) => {
                            try {
                              await resolveDuplicate(candidate.id, action);
                              toast.success(
                                action === "update"
                                  ? "Existing task updated from the later meeting"
                                  : action === "separate"
                                    ? "Created as a separate task"
                                    : "Candidate ignored",
                              );
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Resolution failed",
                              );
                            }
                          }}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this item from review history?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deleteTarget?.title}” from the review page. Any task already added to
              the board will stay there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void removeFromHistory();
              }}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
