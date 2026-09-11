import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { apiErrorMessage } from "@/lib/api-client";
import { statusLabel, type KanbanColumn, type Status } from "@/lib/relay-data";
import { useRelay } from "@/lib/relay-store";
import { CreateColumnDialog } from "./create-column-dialog";

function EditColumnDialog({
  column,
  onOpenChange,
}: {
  column: KanbanColumn | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateKanbanColumn } = useRelay();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748B");
  const [category, setCategory] = useState<Status>("todo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!column) return;
    setName(column.name);
    setColor(column.color);
    setCategory(column.category);
    setError(null);
  }, [column]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!column) return;
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      setError("Column name must contain 2–40 characters.");
      return;
    }
    if (!/^#[A-F\d]{6}$/i.test(color)) {
      setError("Use a six-digit hex color such as #3B82F6.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateKanbanColumn(column.id, {
        name: trimmedName,
        color: color.toUpperCase(),
        category,
      });
      onOpenChange(false);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!column} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit board column</DialogTitle>
          <DialogDescription>Change its label, color, or dashboard category.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="edit-column-name">Name</Label>
            <Input
              id="edit-column-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-column-color">Color</Label>
            <div className="flex gap-2">
              <input
                id="edit-column-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <Input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                maxLength={7}
                className="font-mono uppercase"
                aria-label="Column hex color"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reporting category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as Status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteColumnDialog({
  column,
  onOpenChange,
}: {
  column: KanbanColumn | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeProject, tasks, deleteKanbanColumn } = useRelay();
  const [destinationId, setDestinationId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taskCount = column ? tasks.filter((task) => task.columnId === column.id).length : 0;
  const destinations = (activeProject?.kanbanColumns ?? []).filter(
    (candidate) => candidate.id !== column?.id,
  );

  useEffect(() => {
    setDestinationId("");
    setError(null);
  }, [column]);

  async function remove() {
    if (!column) return;
    if (taskCount > 0 && !destinationId) {
      setError("Choose where to move this column's tasks.");
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteKanbanColumn(column.id, destinationId || undefined);
      onOpenChange(false);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={!!column} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {column?.name}</DialogTitle>
          <DialogDescription>
            {taskCount > 0
              ? `This column has ${taskCount} task${taskCount === 1 ? "" : "s"}. Choose where they should move.`
              : "This empty column will be removed from the board."}
          </DialogDescription>
        </DialogHeader>
        {taskCount > 0 ? (
          <div className="space-y-1.5">
            <Label>Move tasks to</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose another column" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((destination) => (
                  <SelectItem key={destination.id} value={destination.id}>
                    {destination.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={deleting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleting || (taskCount > 0 && !destinationId)}
            onClick={() => void remove()}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Gives project leaders full board-column management without requiring an API console. */
export function ColumnSettings({ canManage }: { canManage: boolean }) {
  const { activeProject, reorderKanbanColumns } = useRelay();
  const columns = useMemo(
    () => [...(activeProject?.kanbanColumns ?? [])].sort((a, b) => a.order - b.order),
    [activeProject?.kanbanColumns],
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<KanbanColumn | null>(null);
  const [deleting, setDeleting] = useState<KanbanColumn | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(columnId: string, direction: -1 | 1) {
    const currentIndex = columns.findIndex((column) => column.id === columnId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= columns.length) return;
    const reordered = [...columns];
    const currentColumn = reordered[currentIndex];
    const nextColumn = reordered[nextIndex];
    if (!currentColumn || !nextColumn) return;
    reordered[currentIndex] = nextColumn;
    reordered[nextIndex] = currentColumn;
    setMoving(columnId);
    setError(null);
    try {
      await reorderKanbanColumns(reordered.map((column) => column.id));
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setMoving(null);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {columns.map((column, index) => (
            <li key={column.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: column.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{column.name}</span>
                <span className="meta-text">Counts as {statusLabel[column.category]}</span>
              </span>
              {canManage ? (
                <div className="flex items-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={index === 0 || !!moving}
                    aria-label={`Move ${column.name} up`}
                    onClick={() => void move(column.id, -1)}
                  >
                    {moving === column.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={index === columns.length - 1 || !!moving}
                    aria-label={`Move ${column.name} down`}
                    onClick={() => void move(column.id, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${column.name}`}
                    onClick={() => setEditing(column)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${column.name}`}
                    onClick={() => setDeleting(column)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {canManage ? (
          <div className="border-t border-border p-3">
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Add column
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
      <CreateColumnDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditColumnDialog
        column={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
      <DeleteColumnDialog
        column={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </>
  );
}
