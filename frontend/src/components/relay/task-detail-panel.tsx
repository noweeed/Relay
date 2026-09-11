import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, MessageSquare, Mic, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatLongDate,
  priorityLabel,
  type Meeting,
  type Priority,
  type Task,
  type TaskComment,
} from "@/lib/relay-data";
import { apiErrorMessage } from "@/lib/api-client";
import { useRelay } from "@/lib/relay-store";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { AssigneeMultiSelect } from "./assignee-multi-select";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-3 py-1.5">
      <span className="text-[12.5px] text-subtle">{label}</span>
      {children}
    </div>
  );
}

type TaskDraft = {
  title: string;
  description: string;
  columnId: string;
  assigneeIds: string[];
  priority: Priority;
  due: string | null;
};

/** Copies editable task fields into local state so nothing is saved accidentally. */
function createTaskDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    columnId: task.columnId ?? "",
    assigneeIds: task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []),
    priority: task.priority,
    due: task.due,
  };
}

export function TaskDetailPanel({
  task,
  meetings,
  onClose,
}: {
  task: Task;
  meetings: Meeting[];
  onClose: () => void;
}) {
  const {
    updateTask,
    deleteTask,
    loadTaskActivity,
    loadTaskComments,
    addTaskComment,
    activeProject,
    members,
  } = useRelay();
  const { user } = useAuth();
  const columns = activeProject?.kanbanColumns ?? [];
  const navigate = useNavigate();
  const [draft, setDraft] = useState<TaskDraft>(() => createTaskDraft(task));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commenting, setCommenting] = useState(false);
  const currentAssigneeIds = task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []);
  const canEdit =
    activeProject?.role === "owner" ||
    activeProject?.role === "admin" ||
    Boolean(user && currentAssigneeIds.includes(user.id));
  const source = meetings.find((m) => m.id === task.sourceMeetingId);
  const isDirty =
    draft.title !== task.title ||
    draft.description !== (task.description ?? "") ||
    draft.columnId !== (task.columnId ?? "") ||
    draft.assigneeIds.join(",") !== currentAssigneeIds.join(",") ||
    draft.priority !== task.priority ||
    draft.due !== task.due;
  const titleIsValid = draft.title.trim().length >= 2;

  useEffect(() => {
    Promise.all([loadTaskActivity(task.id), loadTaskComments(task.id)])
      .then(([, loadedComments]) => setComments(loadedComments))
      .catch((error: unknown) => toast.error(apiErrorMessage(error)));
  }, [loadTaskActivity, loadTaskComments, task.id]);

  /** Saves all confirmed draft changes in one request. */
  async function saveChanges() {
    if (!canEdit || !isDirty || !titleIsValid) return;
    setSaving(true);
    try {
      const updatedTask = await updateTask(task.id, {
        title: draft.title.trim(),
        description: draft.description,
        columnId: draft.columnId,
        assigneeIds: draft.assigneeIds,
        priority: draft.priority,
        due: draft.due,
      });
      setDraft(createTaskDraft(updatedTask));
      await loadTaskActivity(task.id);
      toast.success("Task changes saved");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function submitComment() {
    const body = commentBody.trim();
    if (!canEdit || !body) return;
    setCommenting(true);
    try {
      const comment = await addTaskComment(task.id, body);
      setComments((current) => [...current, comment]);
      setCommentBody("");
      await loadTaskActivity(task.id);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setCommenting(false);
    }
  }

  /** Closes immediately when clean, otherwise asks before discarding draft edits. */
  function requestClose() {
    if (isDirty) {
      setDiscardConfirmationOpen(true);
      return;
    }
    onClose();
  }

  /** Confirms and performs the owner/admin-only backend deletion. */
  async function removeTask() {
    setDeleting(true);
    try {
      await deleteTask(task.id);
      toast.success("Task deleted");
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error));
      setDeleting(false);
    }
  }

  return (
    <aside
      className="enter-rise fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-card shadow-panel"
      aria-label="Task detail"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <Input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          aria-label="Task title"
          aria-invalid={!titleIsValid}
          disabled={!canEdit}
          className="h-8 border-transparent px-1 text-[16px] font-semibold shadow-none hover:border-border focus-visible:border-border"
        />
        <Button variant="ghost" size="icon" onClick={requestClose} aria-label="Close task detail">
          <X className="size-[18px]" />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        <div>
          <Row label="Column">
            <Select
              value={draft.columnId}
              disabled={!canEdit}
              onValueChange={(columnId) => setDraft((current) => ({ ...current, columnId }))}
            >
              <SelectTrigger className="h-8 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Assignees">
            <AssigneeMultiSelect
              members={members}
              selectedIds={draft.assigneeIds}
              onChange={(assigneeIds) => setDraft((current) => ({ ...current, assigneeIds }))}
              disabled={!canEdit}
            />
          </Row>
          <Row label="Priority">
            <Select
              value={draft.priority}
              disabled={!canEdit}
              onValueChange={(v) =>
                setDraft((current) => ({ ...current, priority: v as Priority }))
              }
            >
              <SelectTrigger className="h-8 w-full text-[13px]">
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
          </Row>
          <Row label="Due date">
            <Input
              type="date"
              className="h-8 text-[13px]"
              value={draft.due ?? ""}
              onChange={(e) => setDraft((current) => ({ ...current, due: e.target.value || null }))}
              disabled={!canEdit}
            />
          </Row>
          <Row label="Project">
            <span className="text-[13px] text-muted-foreground">{activeProject?.name}</span>
          </Row>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-description" className="text-[12.5px] text-subtle">
            Description
          </Label>
          <Textarea
            id="task-description"
            rows={4}
            value={draft.description}
            onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
            placeholder="Add detail for whoever picks this up."
            className="text-[13.5px]"
            disabled={!canEdit}
          />
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            <h3 className="text-[13px] font-semibold">Comments</h3>
          </div>
          {comments.length === 0 ? (
            <p className="text-[12.5px] text-subtle">No comments yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-lg border border-border bg-secondary/45 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-medium">{comment.authorName}</span>
                    <span className="meta-text">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px]">{comment.body}</p>
                </li>
              ))}
            </ol>
          )}
          {canEdit ? (
            <div className="flex items-end gap-2">
              <Textarea
                rows={2}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Write a comment…"
                maxLength={2_000}
                className="text-[13px]"
              />
              <Button
                type="button"
                size="icon"
                disabled={commenting || !commentBody.trim()}
                onClick={() => void submitComment()}
                aria-label="Add comment"
              >
                {commenting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          ) : (
            <p className="text-[12.5px] text-subtle">
              Only an owner, admin, or assignee can comment.
            </p>
          )}
        </section>

        {source ? (
          <section className="space-y-2.5">
            <h3 className="text-[13px] font-semibold">Source meeting</h3>
            <div className="rounded-lg border border-border bg-secondary/60 p-3">
              <div className="flex items-center gap-2 text-[13.5px] font-medium">
                <Mic className="size-4 text-primary" />
                {source.title}
              </div>
              <p className="meta-text mt-1">
                {formatLongDate(source.date)} · {task.sourceTimestamp}
              </p>
              <blockquote className="mt-2.5 border-l-2 border-border-strong pl-3 text-[13px] italic text-muted-foreground">
                &ldquo;{task.sourceQuote}&rdquo;
              </blockquote>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  navigate({
                    to: "/app/meetings/$meetingId",
                    params: { meetingId: source.id },
                    search: { t: task.sourceTimestamp ?? "" },
                  })
                }
              >
                View in transcript
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </section>
        ) : null}

        <section className="space-y-2.5">
          <h3 className="text-[13px] font-semibold">Activity</h3>
          <ol className="space-y-3">
            {task.activity.map((a) => (
              <li key={a.id} className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border-strong" />
                <span>
                  <span className="block text-[13px]">
                    {a.actorName ? <strong className="font-medium">{a.actorName} </strong> : null}
                    {a.text}
                  </span>
                  <span className="meta-text">{a.at}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {activeProject?.role === "owner" || activeProject?.role === "admin" ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={() => setDeleteConfirmationOpen(true)}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete task
          </Button>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        {isDirty ? <span className="mr-auto text-[12px] text-subtle">Unsaved changes</span> : null}
        <Button variant="outline" size="sm" onClick={requestClose}>
          Cancel
        </Button>
        {canEdit ? (
          <Button
            size="sm"
            disabled={!isDirty || !titleIsValid || saving}
            onClick={() => setSaveConfirmationOpen(true)}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        ) : (
          <span className="text-[12px] text-subtle">View only</span>
        )}
      </div>

      <AlertDialog open={saveConfirmationOpen} onOpenChange={setSaveConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save task changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the task details for everyone in this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => void saveChanges()}>
              Confirm changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={discardConfirmationOpen} onOpenChange={setDiscardConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits to this task have not been saved and will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onClose}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{task.title}” and its comments will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void removeTask();
              }}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
