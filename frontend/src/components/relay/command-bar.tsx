import { useState } from "react";
import { Sparkle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import { useRelay } from "@/lib/relay-store";
import { toast } from "sonner";

type Command = {
  id: string;
  status:
    | "processing"
    | "awaiting_confirmation"
    | "ambiguous"
    | "executing"
    | "completed"
    | "cancelled"
    | "failed";
  preview?: string;
  candidateMatches: Array<{ id: string; label: string }>;
  result?: { count?: number; tasks?: Array<{ id: string; title: string }> };
  errorMessage?: string;
};

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
  const { activeProject, refreshBoard } = useRelay();
  const [value, setValue] = useState("");
  const [command, setCommand] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setValue("");
    setCommand(null);
    setBusy(false);
  }

  async function runCommand(text: string) {
    if (!activeProject) return;
    setBusy(true);
    try {
      let next = await apiRequest<Command>(`/projects/${activeProject.id}/commands`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setCommand(next);
      for (let attempt = 0; next.status === "processing" && attempt < 40; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        next = await apiRequest<Command>(`/projects/${activeProject.id}/commands/${next.id}`);
        setCommand(next);
      }
      if (next.status === "processing") {
        toast.error("Command interpretation is taking longer than expected.");
      }
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!activeProject || !command) return;
    setBusy(true);
    try {
      const completed = await apiRequest<Command>(
        `/projects/${activeProject.id}/commands/${command.id}/confirm`,
        { method: "POST" },
      );
      setCommand(completed);
      refreshBoard();
      toast.success("Command completed");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!activeProject || !command) return;
    try {
      await apiRequest(`/projects/${activeProject.id}/commands/${command.id}/cancel`, {
        method: "POST",
      });
      reset();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 p-0">
        <DialogTitle className="sr-only">Relay command bar</DialogTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim() && !busy) void runCommand(value.trim());
          }}
          className="flex items-center gap-2.5 border-b border-border py-3 pl-4 pr-12"
        >
          <Sparkle className="size-4 text-primary" />
          <input
            autoFocus
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setCommand(null);
            }}
            placeholder="Ask Relay to update your project..."
            aria-label="Ask Relay to update your project"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle"
          />
        </form>

        <div className="p-4">
          {!command && !busy ? (
            <div className="space-y-1">
              <p className="meta-text px-1 pb-1">Examples</p>
              {examples.map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setValue(example);
                    void runCommand(example);
                  }}
                  className="block w-full rounded-md px-2.5 py-2 text-left text-[13.5px] text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          ) : busy || command?.status === "processing" || command?.status === "executing" ? (
            <p className="text-[13.5px] text-muted-foreground">
              Relay is interpreting the command…
            </p>
          ) : command?.status === "completed" ? (
            <p className="text-[13.5px]">
              {command.result?.tasks
                ? command.result.tasks.length
                  ? `${command.result.count} overdue: ${command.result.tasks.map((task) => task.title).join(", ")}.`
                  : "Nothing is overdue right now."
                : (command.preview ?? "Command completed.")}
            </p>
          ) : command?.status === "ambiguous" ? (
            <div className="space-y-2 text-[13.5px]">
              <p>{command.preview}</p>
              {command.candidateMatches.map((candidate) => (
                <p key={candidate.id} className="text-muted-foreground">
                  {candidate.label}
                </p>
              ))}
            </div>
          ) : command?.status === "failed" ? (
            <p className="text-[13.5px] text-destructive">
              {command.errorMessage ?? "Command failed."}
            </p>
          ) : command?.status === "awaiting_confirmation" ? (
            <div className="space-y-4">
              <p className="text-[14px]">{command.preview}</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => void confirm()}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void cancel()}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">Command cancelled.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
