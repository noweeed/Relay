import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api-client";
import { priorityLabel, type Priority } from "@/lib/relay-data";
import { useRelay } from "@/lib/relay-store";
import { toast } from "sonner";

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultColumnId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultColumnId?: string;
}) {
  const { activeProject, members, addTask } = useRelay();
  const columns = useMemo(() => activeProject?.kanbanColumns ?? [], [activeProject?.kanbanColumns]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("none");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [columnId, setColumnId] = useState(defaultColumnId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fallback =
      columns.find((column) => column.category === "todo")?.id ?? columns[0]?.id ?? "";
    setColumnId(defaultColumnId ?? fallback);
  }, [columns, defaultColumnId, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError("Give the task a title so the team knows what to do.");
      return;
    }
    if (!columnId) {
      setError("This project needs a board column before tasks can be created.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addTask({
        title: title.trim(),
        description,
        assigneeId: assigneeId === "none" ? null : assigneeId,
        due: due || null,
        priority,
        columnId,
      });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setDue("");
      toast.success("Task added to the board");
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Add task</DialogTitle>
          <DialogDescription className="text-[13.5px]">
            Tasks added here are not linked to a meeting.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nt-title">Title</Label>
            <Input
              id="nt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add rate limiting to the login endpoint"
              aria-invalid={!!error}
            />
            {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nt-desc">Description</Label>
            <Textarea
              id="nt-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional detail"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
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
              <Label htmlFor="nt-due">Due date</Label>
              <Input id="nt-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label>Column</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
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
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Creating...
                </>
              ) : (
                "Create task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
