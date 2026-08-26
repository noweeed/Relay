import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeader,
  PriorityBadge,
  Tag,
  UserAvatar,
  EmptyState,
} from "@/components/relay/primitives";
import { useRelay } from "@/lib/relay-store";
import {
  activityFeed,
  dueThisWeek,
  formatDate,
  isOverdue,
  memberById,
  type Task,
} from "@/lib/relay-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Overview | Relay" },
      {
        name: "description",
        content:
          "Project overview with open tasks, upcoming deadlines and recent meeting activity in Relay.",
      },
      { property: "og:title", content: "Overview | Relay" },
      {
        property: "og:description",
        content: "See open work, deadlines and the meetings that created your tasks.",
      },
    ],
  }),
  component: OverviewPage,
});

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "danger" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p
        className={cn(
          "text-[22px] font-semibold leading-tight",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}

function OverviewPage() {
  const { tasks, meetings, activeProject, candidates } = useRelay();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const open = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const week = tasks.filter(dueThisWeek).length;
  const overdue = tasks.filter(isOverdue).length;

  const upcoming: Task[] = [...tasks]
    .filter((t) => t.status !== "done" && t.due)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={activeProject?.name ?? "Project"}
        description="Overview of tasks and recent meeting activity."
      />

      <div className="space-y-8 px-6 py-6 md:px-8">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[74px] rounded-lg" />
            ))
          ) : (
            <>
              <Stat value={open} label="Open tasks" />
              <Stat value={inProgress} label="In progress" />
              <Stat value={week} label="Due this week" tone="warning" />
              <Stat value={overdue} label="Overdue" tone="danger" />
            </>
          )}
        </section>

        <section>
          <h2 className="section-title">Upcoming deadlines</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="p-6 text-[13.5px] text-muted-foreground">
                No dated work left in this project.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] text-subtle">
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Task
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Assignee
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Due
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Priority
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/60"
                    >
                      <td className="px-4 py-2.5 text-[13.5px]">
                        <Link to="/app/board" className="hover:underline">
                          {t.title}
                        </Link>
                        {isOverdue(t) ? (
                          <span className="ml-2">
                            <Tag tone="danger">Overdue</Tag>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                          <UserAvatar memberId={t.assigneeId} size={20} />
                          {memberById(t.assigneeId)?.name.split(" ")[0] ?? "Unassigned"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {formatDate(t.due)}
                      </td>
                      <td className="px-4 py-2.5">
                        <PriorityBadge priority={t.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <div className="flex items-center justify-between">
              <h2 className="section-title">Recent meetings</h2>
              <Link
                to="/app/meetings"
                className="text-[13px] text-muted-foreground hover:text-foreground"
              >
                All meetings
              </Link>
            </div>
            <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
              {meetings.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Mic}
                    title="No meetings yet"
                    description="Paste a transcript to save the first meeting in this project."
                  />
                </div>
              ) : (
                meetings.slice(0, 4).map((m) => {
                  const count = tasks.filter((t) => t.sourceMeetingId === m.id).length;
                  return (
                    <Link
                      key={m.id}
                      to="/app/meetings/$meetingId"
                      params={{ meetingId: m.id }}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-secondary/60"
                    >
                      <span>
                        <span className="block text-[13.5px] font-medium">{m.title}</span>
                        <span className="meta-text">
                          {formatDate(m.date)} · {m.segmentCount ?? 0} segments · {count} linked
                          tasks
                        </span>
                      </span>
                      <Tag tone={m.status === "failed" ? "danger" : "neutral"}>
                        {m.status.replaceAll("_", " ")}
                      </Tag>
                    </Link>
                  );
                })
              )}
            </div>
            {candidates.some((c) => c.state === "pending") ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                {candidates.filter((c) => c.state === "pending").length} extracted tasks are waiting
                in{" "}
                <Link to="/app/review" className="text-primary hover:underline">
                  Review
                </Link>
                .
              </p>
            ) : null}
          </section>

          <section>
            <h2 className="section-title">Recent activity</h2>
            <ul className="mt-3 space-y-3.5">
              {activityFeed.map((a) => (
                <li key={a.id} className="flex gap-2.5">
                  <UserAvatar memberId={a.who} size={22} />
                  <span>
                    <span className="text-[13.5px]">
                      <span className="font-medium">{memberById(a.who)?.name.split(" ")[0]}</span>{" "}
                      {a.text}
                    </span>
                    <span className="meta-text block">{a.at}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
