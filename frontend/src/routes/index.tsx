import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, GitMerge, ListChecks, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Relay — Meetings become tracked work" },
      {
        name: "description",
        content:
          "Relay turns meeting recordings into reviewed action items and keeps them on a project board, updating existing tasks instead of duplicating them.",
      },
      { property: "og:title", content: "Relay — Meetings become tracked work" },
      {
        property: "og:description",
        content:
          "Upload a recording, review the extracted tasks, and track the approved work on one board.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: Mic,
    title: "Upload the meeting",
    body: "Drop in a recording or paste a transcript. Relay transcribes it and separates who said what.",
  },
  {
    icon: ListChecks,
    title: "Review what it found",
    body: "Every extracted task shows the sentence it came from, so you approve, edit or discard with context.",
  },
  {
    icon: GitMerge,
    title: "Later meetings update work",
    body: "When a follow-up mentions existing work, Relay proposes an update instead of creating a duplicate.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
              R
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Relay</span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-14">
          <div className="max-w-2xl">
            <h1 className="text-[44px] leading-[1.1] font-semibold tracking-tight">
              Meetings end. The work should already be on the board.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
              Relay listens to your meetings, pulls out the commitments people actually made, and
              waits for a human to approve them before anything reaches your project board.
            </p>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link to="/signup">
                  Start with a meeting <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="meta-text ml-2">Relay — Review extracted tasks</span>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                {
                  title: "Finish authentication API",
                  quote: '"I\'ll finish the auth API by Friday." — Naveed, 18:32',
                  meta: "Due Fri · High confidence",
                },
                {
                  title: "Update onboarding copy",
                  quote: '"Someone should rewrite the onboarding screens." — Priya, 24:07',
                  meta: "No owner yet · Needs review",
                },
                {
                  title: "Ship billing migration",
                  quote: '"Billing migration slips to next sprint." — Dana, 31:15',
                  meta: "Updates an existing task",
                },
                {
                  title: "Book customer interviews",
                  quote: '"I\'ll line up three interviews next week." — Marc, 38:41',
                  meta: "Due next week · Medium confidence",
                },
              ].map((c) => (
                <div key={c.title} className="rounded-lg border border-border p-4">
                  <p className="text-[14px] font-medium">{c.title}</p>
                  <p className="mt-2 border-l-2 border-primary/40 pl-3 text-[13px] text-muted-foreground italic">
                    {c.quote}
                  </p>
                  <p className="meta-text mt-3">{c.meta}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-[24px] font-semibold tracking-tight">How Relay works</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.title}>
                  <s.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-[15px] font-semibold">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-14">
            <div className="max-w-md">
              <h2 className="text-[22px] font-semibold tracking-tight">
                Nothing reaches the board unreviewed
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Relay proposes. You decide. Every task keeps a link back to the moment in the
                meeting where it was agreed.
              </p>
            </div>
            <ul className="ml-auto space-y-2.5">
              {[
                "Speaker-attributed transcripts",
                "Duplicate detection across meetings",
                "Deadline reminders in Telegram",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2 text-[14px]">
                  <CheckCircle2 className="size-4 text-success" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="meta-text">Relay</span>
          <Link to="/login" className="meta-text hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
