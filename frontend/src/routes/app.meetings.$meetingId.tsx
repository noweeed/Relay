import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, ListChecks, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  EmptyState,
  PageHeader,
  PriorityBadge,
  StatusPill,
  UserAvatar,
} from "@/components/relay/primitives";
import { TaskDetailPanel } from "@/components/relay/task-detail-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiErrorMessage } from "@/lib/api-client";
import { formatDate, formatLongDate, type Task, type TranscriptSegment } from "@/lib/relay-data";
import { useRelay } from "@/lib/relay-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/meetings/$meetingId")({
  validateSearch: z.object({ t: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Meeting transcript | Relay" },
      { name: "description", content: "Parsed transcript segments and linked project tasks." },
    ],
  }),
  component: MeetingDetail,
});

/** Shows persisted transcript segments and tasks traced to one authorized meeting. */
function MeetingDetail() {
  const { meetingId } = Route.useParams();
  const { t: focusTime } = Route.useSearch();
  const {
    activeProject,
    meetings,
    meetingsLoading,
    loadMeeting,
    loadMeetingTranscript,
    loadMeetingTasks,
    reprocessMeeting,
  } = useRelay();
  const navigate = useNavigate();
  const meeting = meetings.find((item) => item.id === meetingId);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [meetingTasks, setMeetingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    /** Loads transcript and traceable tasks together for the selected meeting. */
    async function loadMeetingContent() {
      setLoading(true);
      try {
        const [, loadedSegments, loadedTasks] = await Promise.all([
          loadMeeting(meetingId),
          loadMeetingTranscript(meetingId),
          loadMeetingTasks(meetingId),
        ]);
        if (!active) return;
        setSegments(loadedSegments);
        setMeetingTasks(loadedTasks);
        setError(null);
      } catch (requestError) {
        if (active) setError(apiErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMeetingContent();
    return () => {
      active = false;
    };
  }, [loadMeeting, loadMeetingTasks, loadMeetingTranscript, meetingId]);

  /** Calls the real retry endpoint, which only accepts failed meetings. */
  async function handleReprocess() {
    setRetrying(true);
    try {
      await reprocessMeeting(meetingId);
      toast.success("Meeting reset and ready to process again");
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
    } finally {
      setRetrying(false);
    }
  }

  /** Copies the parsed transcript currently visible to the member. */
  async function copyTranscript() {
    const text = segments
      .map((segment) => `${segment.speakerName ? `${segment.speakerName}: ` : ""}${segment.text}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Transcript copied");
  }

  if (!meeting && (meetingsLoading || loading)) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="px-6 py-10 md:px-8">
        <EmptyState
          title="Meeting not available"
          description={error ?? "This meeting is not part of the selected project."}
          actions={
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/meetings" })}>
              Back to meetings
            </Button>
          }
        />
      </div>
    );
  }

  const canManage = activeProject?.role === "owner" || activeProject?.role === "admin";
  const openTask = meetingTasks.find((task) => task.id === openTaskId) ?? null;

  return (
    <>
      <PageHeader
        title={meeting.title}
        description={`${formatLongDate(meeting.date)} · ${meeting.segmentCount ?? segments.length} segments · ${meeting.status.replaceAll("_", " ")}`}
        actions={
          <>
            <Button
              variant="outline"
              disabled={segments.length === 0}
              onClick={() => void copyTranscript()}
            >
              <Copy className="size-4" /> Copy transcript
            </Button>
            {canManage && meeting.status === "failed" ? (
              <Button variant="outline" disabled={retrying} onClick={() => void handleReprocess()}>
                {retrying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Retry
              </Button>
            ) : null}
          </>
        }
      />

      <div className="px-6 py-6 md:px-8">
        {meeting.errorMessage ? (
          <p className="mb-4 max-w-3xl rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive">
            {meeting.errorMessage}
          </p>
        ) : null}
        <Tabs defaultValue="transcript">
          <TabsList>
            <TabsTrigger value="transcript">Transcript ({segments.length})</TabsTrigger>
            <TabsTrigger value="tasks">Linked tasks ({meetingTasks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="transcript" className="mt-5">
            {loading ? (
              <div className="flex max-w-3xl justify-center rounded-xl border border-border bg-card py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <EmptyState title="Transcript could not be loaded" description={error} />
            ) : segments.length === 0 ? (
              <EmptyState
                title="No transcript segments"
                description="This meeting has no parsed transcript rows."
              />
            ) : (
              <div className="max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
                {segments.map((segment) => {
                  const linked = meetingTasks.find((task) => task.sourceSegmentId === segment.id);
                  const focused = focusTime === segment.time;
                  return (
                    <div
                      key={segment.id}
                      className={cn("px-4 py-3.5", focused && "bg-primary-soft")}
                    >
                      <div className="flex items-baseline gap-2.5">
                        <span className="w-11 shrink-0 font-mono text-[12px] text-subtle">
                          {segment.time}
                        </span>
                        <span className="text-[13px] font-medium">
                          {segment.speakerName ?? "Unknown speaker"}
                        </span>
                        {linked ? (
                          <button
                            onClick={() =>
                              setExpanded((current) => (current === segment.id ? null : segment.id))
                            }
                            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-soft px-1.5 py-0.5 text-[11.5px] font-medium text-primary"
                          >
                            <ListChecks className="size-3.5" /> Task
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 pl-[54px] text-[14px] leading-relaxed">{segment.text}</p>
                      {linked && expanded === segment.id ? (
                        <div className="mt-2.5 ml-[54px] rounded-lg border border-border bg-secondary/60 p-3">
                          <p className="meta-text">Linked task</p>
                          <button
                            onClick={() => setOpenTaskId(linked.id)}
                            className="mt-0.5 text-[13.5px] font-medium hover:underline"
                          >
                            {linked.title}
                          </button>
                          <div className="mt-2 flex items-center gap-3">
                            <StatusPill status={linked.status} />
                            <PriorityBadge priority={linked.priority} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="mt-5">
            {meetingTasks.length === 0 ? (
              <EmptyState
                title="No linked tasks"
                description="AI extraction and candidate approval are not connected yet, so new transcripts will normally have no linked tasks."
              />
            ) : (
              <ul className="max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
                {meetingTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      onClick={() => setOpenTaskId(task.id)}
                      className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-secondary/60"
                    >
                      <span className="min-w-0 flex-1 text-[13.5px] font-medium">{task.title}</span>
                      {task.assigneeId ? <UserAvatar memberId={task.assigneeId} size={20} /> : null}
                      <span className="text-[13px] text-muted-foreground">
                        {task.due ? formatDate(task.due) : "No due date"}
                      </span>
                      <StatusPill status={task.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {openTask ? (
        <TaskDetailPanel task={openTask} meetings={meetings} onClose={() => setOpenTaskId(null)} />
      ) : null}
    </>
  );
}
