import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Filter, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/relay/primitives";
import { TaskCard } from "@/components/relay/task-card";
import { TaskDetailPanel } from "@/components/relay/task-detail-panel";
import { CreateTaskDialog } from "@/components/relay/create-task-dialog";
import { CreateColumnDialog } from "@/components/relay/create-column-dialog";
import { apiErrorMessage } from "@/lib/api-client";
import { useRelay } from "@/lib/relay-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app/board")({
  head: () => ({
    meta: [
      { title: "Board | Relay" },
      {
        name: "description",
        content: "Kanban board of approved tasks, each linked back to the meeting it came from.",
      },
      { property: "og:title", content: "Board | Relay" },
      {
        property: "og:description",
        content: "Track todo, in progress and completed work for your project.",
      },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { activeProject, members, tasks, tasksLoading, tasksError, meetings, moveTask } =
    useRelay();
  const columns = activeProject?.kanbanColumns ?? [];
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const canManageColumns = activeProject?.role === "owner" || activeProject?.role === "admin";

  const filtered = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) &&
      (assignee === "all" || t.assigneeId === assignee) &&
      (priority === "all" || t.priority === priority),
  );

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  async function drop(columnId: string) {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    setDragOver(null);
    setSavingId(id);
    try {
      await moveTask(id, columnId);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Board"
        description="Drag a task to change its status."
        actions={
          <>
            {canManageColumns ? (
              <Button
                variant="outline"
                disabled={columns.length >= 20}
                title={columns.length >= 20 ? "A board can contain at most 20 columns" : undefined}
                onClick={() => setColumnOpen(true)}
              >
                <Plus className="size-4" /> Add column
              </Button>
            ) : null}
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add task
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3 md:px-8">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <Filter className="hidden size-4 text-subtle sm:block" aria-hidden="true" />
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-8 w-40 text-[13px]" aria-label="Filter by assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-8 w-36 text-[13px]" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="px-6 py-6 md:px-8">
        {tasksLoading ? (
          <div className="flex gap-4 overflow-hidden">
            {columns.map((c) => (
              <div key={c.id} className="min-w-[280px] flex-1 space-y-3">
                <Skeleton className="h-5 w-28" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        ) : tasksError ? (
          <EmptyState title="Board unavailable" description={tasksError} />
        ) : !activeProject ? (
          <EmptyState
            title="Create a project first"
            description="A task board belongs to one project and its members."
            actions={
              <Button size="sm" onClick={() => navigate({ to: "/app/new-project" })}>
                <Plus className="size-4" /> Create project
              </Button>
            }
          />
        ) : columns.length === 0 ? (
          <EmptyState
            title="No board columns"
            description="Add at least one Todo-category column before creating tasks."
            actions={
              canManageColumns ? (
                <Button size="sm" onClick={() => setColumnOpen(true)}>
                  <Plus className="size-4" /> Add column
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:px-0">
            {columns.map((col) => {
              const items = filtered.filter((task) => task.columnId === col.id);
              return (
                <section
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(col.id);
                  }}
                  onDragLeave={() =>
                    setDragOver((current) => (current === col.id ? null : current))
                  }
                  onDrop={() => void drop(col.id)}
                  className={cn(
                    "min-w-[280px] flex-1 basis-[320px] rounded-xl border border-transparent p-1 transition-colors duration-150",
                    dragOver === col.id && "border-dashed border-primary/50 bg-primary-soft/50",
                  )}
                >
                  <div className="flex items-center gap-2 px-2 py-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <h2 className="text-[13.5px] font-semibold">{col.name}</h2>
                    <span className="text-[12.5px] text-subtle">{items.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {items.map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => setDragId(null)}
                        className="relative"
                      >
                        <TaskCard
                          task={t}
                          meetings={meetings}
                          dragging={dragId === t.id}
                          onOpen={() => setOpenTaskId(t.id)}
                        />
                        {savingId === t.id ? (
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-card px-1.5 py-0.5 text-[11.5px] text-subtle">
                            <Loader2 className="size-3 animate-spin" /> Saving
                          </span>
                        ) : null}
                      </div>
                    ))}
                    {items.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12.5px] text-subtle">
                        Nothing here
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {openTask ? (
        <TaskDetailPanel task={openTask} meetings={meetings} onClose={() => setOpenTaskId(null)} />
      ) : null}
      <CreateTaskDialog open={addOpen} onOpenChange={setAddOpen} />
      <CreateColumnDialog open={columnOpen} onOpenChange={setColumnOpen} />
    </>
  );
}
