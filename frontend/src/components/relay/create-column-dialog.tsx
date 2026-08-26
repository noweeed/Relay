import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { type Status } from "@/lib/relay-data";
import { useRelay } from "@/lib/relay-store";

const DEFAULT_COLOR = "#64748B";

type CreateColumnDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Collects the user-controlled Kanban properties; the server generates ID and order. */
export function CreateColumnDialog({ open, onOpenChange }: CreateColumnDialogProps) {
  const { createKanbanColumn } = useRelay();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [category, setCategory] = useState<Status>("todo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setColor(DEFAULT_COLOR);
    setCategory("todo");
    setError(null);
  }, [open]);

  /** Validates browser input and sends the model-backed column payload to Relay. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      setError("Column name must contain 2–40 characters.");
      return;
    }
    if (!/^#[A-F\d]{6}$/i.test(color)) {
      setError("Use a six-digit hex color such as #3B82F6.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createKanbanColumn({ name: trimmedName, color: color.toUpperCase(), category });
      onOpenChange(false);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add board column</DialogTitle>
          <DialogDescription>
            Choose how the stage appears and how Relay counts its tasks. Its stable ID and position
            are assigned automatically.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="column-name">Name</Label>
            <Input
              id="column-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Code Review"
              minLength={2}
              maxLength={40}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="column-color">Color</Label>
            <div className="flex items-center gap-2">
              <input
                id="column-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                aria-label="Column color picker"
              />
              <Input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#3B82F6"
                maxLength={7}
                className="font-mono uppercase"
                aria-label="Column hex color"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="column-category">Reporting category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as Status)}>
              <SelectTrigger id="column-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Todo — work not started</SelectItem>
                <SelectItem value="in_progress">In progress — active work</SelectItem>
                <SelectItem value="done">Done — completed work</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[12px] text-muted-foreground">
              Categories power dashboard totals and determine the default destination for new tasks.
            </p>
          </div>

          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Adding…" : "Add column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
