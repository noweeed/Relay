import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FileAudio, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/relay/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api-client";
import { useRelay } from "@/lib/relay-store";

export const Route = createFileRoute("/app/upload")({
  head: () => ({
    meta: [
      { title: "Add meeting | Relay" },
      {
        name: "description",
        content: "Paste a meeting transcript and save its parsed conversation in Relay.",
      },
    ],
  }),
  component: UploadPage,
});

/** Creates the pasted-transcript meeting supported by the current backend. */
function UploadPage() {
  const navigate = useNavigate();
  const { activeProject, createTranscriptMeeting } = useRelay();
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Validates the form, persists the transcript, then opens its parsed segments. */
  async function handleSubmit() {
    if (!title.trim() || !transcript.trim()) {
      setError("Add a meeting title and paste the transcript before saving.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const meeting = await createTranscriptMeeting(title.trim(), transcript.trim());
      await navigate({ to: "/app/meetings/$meetingId", params: { meetingId: meeting.id } });
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Add meeting"
        description="Paste a transcript now. Audio upload and AI task extraction arrive in later milestones."
      />

      <div className="flex justify-center px-6 py-8 md:px-8">
        <Tabs defaultValue="transcript" className="w-full max-w-2xl">
          <TabsList>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="audio">Audio (coming later)</TabsTrigger>
          </TabsList>

          <TabsContent value="transcript" className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-title">Meeting title</Label>
              <Input
                id="meeting-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Weekly Product Sync"
                maxLength={200}
                aria-invalid={!!error}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meeting-transcript">Transcript</Label>
              <Textarea
                id="meeting-transcript"
                rows={14}
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder={
                  "Naveed: I'll finish the authentication API by Friday.\nSarah: Sounds good."
                }
                maxLength={500_000}
              />
              <p className="text-[12px] text-muted-foreground">
                Speaker labels such as “Name: text” are parsed into ordered segments.
              </p>
            </div>
            {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
            <Button disabled={submitting || !activeProject} onClick={() => void handleSubmit()}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {submitting ? "Saving transcript…" : "Save transcript"}
            </Button>
          </TabsContent>

          <TabsContent value="audio" className="mt-5">
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <FileAudio className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-[14px] font-medium">Audio upload is planned for v0.7</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Use the transcript tab for the currently implemented meeting flow.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
