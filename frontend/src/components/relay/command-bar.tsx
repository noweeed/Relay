import { useState } from "react";
import { CornerDownLeft, Sparkle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api-client";
import { useRelay } from "@/lib/relay-store";
import { toast } from "sonner";

type Intent =
  | {
      kind: "move";
      taskId: string;
      title: string;
      fromName: string;
      toName: string;
      toColumnId: string;
    }
  | { kind: "assign"; taskId: string; title: string; assigneeId: string; assigneeName: string }
  | { kind: "answer"; text: string };

const examples = [
  "Move authentication to Done",
  "Assign dashboard redesign to Abdullah",
  "What tasks are overdue?",
];

export function CommandBar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { activeProject, members, tasks, moveTask, updateTask } = useRelay();
  const columns = activeProject?.kanbanColumns ?? [];
  const [value, setValue] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);

  function parse(input: string): Intent {
    const q = input.toLowerCase();
    const match =
      tasks.find((t) => q.includes(t.title.toLowerCase().split(" ")[1] ?? "@@")) ??
      tasks.find((t) =>
        t.title
          .toLowerCase()
          .split(" ")
          .some((w) => w.length > 5 && q.includes(w)),
      );

    if (q.startsWith("what") || q.includes("overdue")) {
      const overdue = tasks.filter((t) => t.due && t.status !== "done" && t.due < "2026-08-23");
      return {
        kind: "answer",
        text: overdue.length
          ? `${overdue.length} tasks are overdue: ${overdue.map((t) => t.title).join(", ")}.`
          : "Nothing is overdue right now.",
      };
    }
    if (q.includes("assign") && match) {
      const assignee = members.find((member) =>
        q.includes(member.name.toLowerCase().split(" ")[0] ?? "@@"),
      );
      if (assignee) {
        return {
          kind: "assign",
          taskId: match.id,
          title: match.title,
          assigneeId: assignee.id,
          assigneeName: assignee.name,
        };
      }
    }
    if (match) {
      const destination =
        columns.find((column) => q.includes(column.name.toLowerCase())) ??
        columns.find((column) => q.includes("done") && column.category === "done") ??
        columns.find((column) => q.includes("progress") && column.category === "in_progress") ??
        columns.find((column) => column.category === "todo");
      if (destination) {
        const current = columns.find((column) => column.id === match.columnId);
        return {
          kind: "move",
          taskId: match.id,
          title: match.title,
          fromName: current?.name ?? "current column",
          toName: destination.name,
          toColumnId: destination.id,
        };
      }
    }
    return {
      kind: "answer",
      text: "Relay couldn't match that to a task in this project. Try naming the task.",
    };
  }

  function reset() {
    setValue("");
    setIntent(null);
  }

  async function confirm() {
    if (!intent) return;
    try {
      if (intent.kind === "move") {
        await moveTask(intent.taskId, intent.toColumnId);
        toast.success(`Moved "${intent.title}" to ${intent.toName}`);
      } else if (intent.kind === "assign") {
        await updateTask(
          intent.taskId,
          { assigneeId: intent.assigneeId },
          "Assignee changed from the command bar",
        );
        toast.success(`Assigned "${intent.title}" to ${intent.assigneeName}`);
      }
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 p-0">
        <DialogTitle className="sr-only">Relay command bar</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) setIntent(parse(value.trim()));
          }}
          className="flex items-center gap-2.5 border-b border-border px-4 py-3"
        >
          <Sparkle className="size-4 text-primary" />
          <input
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setIntent(null);
            }}
            placeholder="Ask Relay to update your project..."
            aria-label="Ask Relay to update your project"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle"
          />
          <kbd className="rounded border border-border px-1.5 text-[11px] text-subtle">
            <CornerDownLeft className="inline size-3" />
          </kbd>
        </form>

        <div className="p-4">
          {!intent ? (
            <div className="space-y-1">
              <p className="meta-text px-1 pb-1">Examples</p>
              {examples.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setValue(e);
                    setIntent(parse(e));
                  }}
                  className="block w-full rounded-md px-2.5 py-2 text-left text-[13.5px] text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : intent.kind === "answer" ? (
            <p className="text-[13.5px]">{intent.text}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-[14px]">
                {intent.kind === "move" ? (
                  <>
                    Move <span className="font-medium">&ldquo;{intent.title}&rdquo;</span> from{" "}
                    {intent.fromName} to {intent.toName}?
                  </>
                ) : (
                  <>
                    Assign <span className="font-medium">&ldquo;{intent.title}&rdquo;</span> to{" "}
                    <span>{intent.assigneeName}</span>?
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void confirm()}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
