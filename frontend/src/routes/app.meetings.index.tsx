import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mic, Search, Upload } from "lucide-react";
import { useState } from "react";
import { EmptyState, PageHeader, Tag, UserAvatar } from "@/components/relay/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/relay-data";
import { useRelay } from "@/lib/relay-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/meetings/")({
  head: () => ({
    meta: [
      { title: "Meetings | Relay" },
      { name: "description", content: "Saved project transcripts and their processing state." },
    ],
  }),
  component: MeetingsPage,
});

const filters = ["All", "Saved", "Processing", "Ready", "Completed", "Failed"] as const;

/** Converts the backend state machine value into a readable badge. */
function meetingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    created: "Saved",
    processing: "Processing",
    ready_for_review: "Ready for review",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[status] ?? status;
}

/** Displays project-scoped meeting metadata loaded from the API. */
function MeetingsPage() {
  const { meetings, meetingsLoading, meetingsError, tasks, members } = useRelay();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const rows = meetings.filter((meeting) => {
    const matchesQuery = meeting.title.toLowerCase().includes(query.toLowerCase());
    const statusLabel = meetingStatusLabel(meeting.status);
    const matchesFilter =
      filter === "All" ||
      statusLabel === filter ||
      (filter === "Ready" && statusLabel === "Ready for review");
    return matchesQuery && matchesFilter;
  });

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Transcripts saved in the selected project. AI extraction is not running yet."
        actions={
          <Button onClick={() => navigate({ to: "/app/upload" })}>
            <Upload className="size-4" /> Add transcript
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3 md:px-8">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search meetings"
            aria-label="Search meetings"
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                filter === item
                  ? "bg-primary-soft font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {meetingsLoading ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8" />
            ))}
          </div>
        ) : meetingsError ? (
          <EmptyState icon={Mic} title="Meetings could not be loaded" description={meetingsError} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Mic}
            title={meetings.length === 0 ? "No meetings yet" : "No matching meetings"}
            description={
              meetings.length === 0
                ? "Paste a transcript to create the first project meeting."
                : "Try a different search or status filter."
            }
            actions={
              meetings.length === 0 ? (
                <Button size="sm" onClick={() => navigate({ to: "/app/upload" })}>
                  Add transcript
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-border text-[12px] text-subtle">
                  {["Meeting", "Saved", "Segments", "Tasks", "Status", "Created by"].map(
                    (heading) => (
                      <th key={heading} scope="col" className="px-4 py-2.5 font-medium">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((meeting) => {
                  const creator = members.find((member) => member.id === meeting.createdBy);
                  return (
                    <tr
                      key={meeting.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to="/app/meetings/$meetingId"
                          params={{ meetingId: meeting.id }}
                          className="text-[13.5px] font-medium hover:underline"
                        >
                          {meeting.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground">
                        {formatDate(meeting.date)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground">
                        {meeting.segmentCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground">
                        {tasks.filter((task) => task.sourceMeetingId === meeting.id).length}
                      </td>
                      <td className="px-4 py-3">
                        <Tag
                          tone={
                            meeting.status === "failed"
                              ? "danger"
                              : meeting.status === "ready_for_review"
                                ? "brand"
                                : "neutral"
                          }
                        >
                          {meetingStatusLabel(meeting.status)}
                        </Tag>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground">
                        {creator ? (
                          <span className="flex items-center gap-2">
                            <UserAvatar memberId={creator.id} size={22} /> {creator.name}
                          </span>
                        ) : (
                          "Project member"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
