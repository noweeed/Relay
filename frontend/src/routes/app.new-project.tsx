import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader } from "@/components/relay/primitives";
import { useRelay } from "@/lib/relay-store";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-client";

export const Route = createFileRoute("/app/new-project")({
  head: () => ({
    meta: [
      { title: "Create a project | Relay" },
      {
        name: "description",
        content: "Projects keep meetings, tasks and team members in one workspace.",
      },
      { property: "og:title", content: "Create a project | Relay" },
      {
        property: "og:description",
        content: "Start a Relay workspace for a team and its meetings.",
      },
    ],
  }),
  component: NewProjectPage,
});

function NewProjectPage() {
  const { createProject } = useRelay();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Give the project a name your team will recognize.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createProject(name.trim(), description.trim());
      setOpen(false);
      toast.success("Project created");
      navigate({ to: "/app" });
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project has its own meetings, tasks and members."
      />
      <div className="px-6 py-10 md:px-8">
        <EmptyState
          icon={FolderPlus}
          title="Create your first project"
          description="Projects keep meetings, tasks and team members organized in one workspace."
          actions={<Button onClick={() => setOpen(true)}>Create project</Button>}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Create project</DialogTitle>
            <DialogDescription className="text-[13.5px]">
              You can invite people once the project exists.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Project name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Atlas Web App"
                aria-invalid={!!error}
              />
              {error ? <p className="text-[12.5px] text-destructive">{error}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Description (optional)</Label>
              <Textarea
                id="p-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
                  "Create project"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
