import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  GitBranch,
  GitMerge,
  History,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Mic,
  Moon,
  Pencil,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { RelayBrand } from "@/components/relay/relay-brand";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/relay-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Relay" },
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
    number: "01",
    icon: Mic,
    title: "Bring in the meeting",
    body: "Upload a recording or paste a transcript. Relay keeps speakers and timestamps attached to the conversation.",
  },
  {
    number: "02",
    icon: ListChecks,
    title: "Review the proposed work",
    body: "Check the tasks, owners and deadlines Relay finds, then decide what belongs on the board.",
  },
  {
    number: "03",
    icon: LayoutDashboard,
    title: "Keep the board current",
    body: "Approved tasks move to the project board. Later meetings can update existing work instead of creating another copy.",
  },
];

const features = [
  {
    icon: MessageSquareText,
    title: "Context stays attached",
    body: "Every task links back to the meeting and conversation that created it, so the reason behind the work doesn't disappear.",
  },
  {
    icon: ShieldCheck,
    title: "Human approval",
    body: "Relay proposes tasks and changes. Your team decides what actually gets added or updated.",
  },
  {
    icon: History,
    title: "Visible timeline",
    body: "See how a task changed over time, which meeting triggered the change, and what was updated.",
  },
  {
    icon: GitMerge,
    title: "Smart updates",
    body: "Relay can recognize follow-up work and suggest updating an existing task instead of creating another duplicate.",
  },
];

function Landing() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <Link to="/" className="flex h-full shrink-0 items-center" aria-label="Relay homepage">
            <RelayBrand size="sm" />
          </Link>
          <nav className="ml-8 hidden items-center gap-6 md:flex" aria-label="Main navigation">
            <a href="#product" className="landing-nav-link">
              Product
            </a>
            <a href="#how-it-works" className="landing-nav-link">
              How it works
            </a>
            <a href="#features" className="landing-nav-link">
              Features
            </a>
          </nav>
          <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Account navigation">
            <button
              type="button"
              onClick={() => setTheme(nextTheme)}
              aria-label={`Switch to ${nextTheme} theme`}
              title={`Switch to ${nextTheme} theme`}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {theme === "dark" ? (
                <Moon className="size-[17px]" aria-hidden="true" />
              ) : (
                <Sun className="size-[17px]" aria-hidden="true" />
              )}
            </button>
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="px-3 sm:px-4">
              <Link to="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl items-center px-6 py-16 md:py-20">
          <div className="w-full max-w-3xl">
            <p className="mb-5 text-[12px] font-semibold tracking-[0.14em] text-primary uppercase">
              Meetings → review → board
            </p>
            <h1 className="max-w-3xl text-[42px] leading-[1.06] font-semibold tracking-[-0.035em] sm:text-[58px]">
              Turn meetings into work that gets done.
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-7 text-muted-foreground sm:text-[17px]">
              Relay extracts action items from meetings, lets your team review them, and keeps every
              task connected to the conversation that created it.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link to="/signup">
                  Get started <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
          </div>
        </section>

        <section
          id="product"
          className="flex min-h-[calc(100svh-4rem)] scroll-mt-16 items-center px-4 py-16 sm:px-6"
        >
          <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <h2 className="text-[14px] font-semibold">Weekly product sync</h2>
              <span className="text-[12px] text-subtle">6 tasks </span>
            </div>
            <div className="grid md:grid-cols-[0.38fr_0.62fr]">
              <aside className="border-b border-border bg-muted/20 p-5 md:border-r md:border-b-0">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-subtle uppercase">
                  <Mic className="size-3" aria-hidden="true" /> Transcript
                </p>
                <div className="mt-4 space-y-4">
                  <TranscriptSpeaker
                    initials="N"
                    name="Naveed"
                    quote="I’ll finish the authentication API by Friday."
                  />
                  <TranscriptSpeaker
                    initials="A"
                    name="Ahmed"
                    quote="I’ll handle the Supabase setup by September 14."
                  />
                  <TranscriptSpeaker
                    initials="P"
                    name="Priya"
                    quote="I’ll finish the onboarding copy before Thursday."
                  />
                  <TranscriptSpeaker
                    initials="J"
                    name="Jordan"
                    quote="I’ll review the analytics events this afternoon."
                  />
                </div>
              </aside>

              <div className="space-y-3 p-4">
                <article className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 size-4 shrink-0 rounded-[5px] border border-primary/65"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-medium">Finish authentication API</h3>
                      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
                        <TaskField label="Assignee" value="Naveed" />
                        <TaskField label="Deadline" value="Friday" />
                        <TaskField label="Priority" value="High" />
                      </dl>
                      <p className="mt-2 border-l-2 border-border-strong pl-2 text-[12.5px] italic text-muted-foreground">
                        “I’ll finish the authentication API by Friday.”
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Preview actions">
                        <PreviewAction primary icon={Check} label="Approve" />
                        <PreviewAction icon={Pencil} label="Edit" />
                        <PreviewAction quiet icon={X} label="Reject" />
                      </div>
                    </div>
                  </div>
                </article>

                <article className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 size-4 shrink-0 rounded-[5px] border border-primary/65"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-medium">Complete Supabase project</h3>
                      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
                        <TaskField label="Assignee" value="Ahmed" />
                        <TaskField label="Deadline" value="Sep 14" />
                        <TaskField label="Priority" value="Medium" />
                      </dl>
                      <div className="mt-2.5 rounded-md border border-warning/55 bg-warning/10 p-2.5">
                        <div className="flex items-center gap-1.5 text-warning">
                          <GitBranch className="size-3" aria-hidden="true" />
                          <span className="text-[12.5px] font-semibold text-foreground">
                            Possible existing task
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11.5px] text-muted-foreground">
                          <p>
                            Existing:{" "}
                            <strong className="font-medium text-foreground">
                              Set up Supabase project
                            </strong>
                          </p>
                          <p>High confidence · Sep 12 → Sep 14 · High → Medium</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Preview actions">
                          <PreviewAction label="Update existing" />
                          <PreviewAction primary label="Create separate task" />
                          <PreviewAction quiet label="Ignore" />
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="flex min-h-[calc(100svh-4rem)] scroll-mt-16 items-center bg-muted/20"
        >
          <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold tracking-[0.14em] text-primary uppercase">
                How it works
              </p>
              <h2 className="mt-4 text-[30px] leading-tight font-semibold tracking-tight sm:text-[34px]">
                A clear path from conversation to board.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
                Relay does the sorting. Your team keeps control of what becomes real work.
              </p>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-primary">{step.number}</span>
                    <step.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-[16px] font-semibold">{step.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="flex min-h-[calc(100svh-4rem)] scroll-mt-8 items-center">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold tracking-[0.14em] text-primary uppercase">
                Built for follow-through
              </p>
              <h2 className="mt-4 text-[30px] leading-tight font-semibold tracking-tight sm:text-[34px]">
                The context your tasks usually lose.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
                Relay keeps the reasoning, history and human decisions behind the work.
              </p>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {features.map((feature) => (
                <article key={feature.title} className="bg-card p-6 sm:p-7">
                  <feature.icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-[16px] font-semibold">{feature.title}</h3>
                  <p className="mt-2 max-w-md text-[14px] leading-6 text-muted-foreground">
                    {feature.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
            <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-6 py-10 sm:px-9 md:flex md:items-center md:justify-between md:gap-10">
              <div className="max-w-xl">
                <h2 className="text-[28px] font-semibold tracking-tight">
                  Start with your next meeting.
                </h2>
                <p className="mt-3 text-[14px] leading-6 text-muted-foreground">
                  Review what was agreed, send the right work to the board, and keep its history in
                  one place.
                </p>
              </div>
              <Button asChild size="lg" className="mt-7 shrink-0 md:mt-0">
                <Link to="/signup">
                  Get started <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center">
          <RelayBrand size="sm" />
          <p className="meta-text sm:ml-2">Meetings become tracked work.</p>
          <nav
            className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:ml-auto"
            aria-label="Footer"
          >
            <a href="#product" className="meta-text hover:text-foreground">
              Product
            </a>
            <a href="#how-it-works" className="meta-text hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="meta-text hover:text-foreground">
              Features
            </a>
            <Link to="/login" className="meta-text hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function TaskField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] text-subtle">{label}</dt>
      <dd className="text-[12px]">{value}</dd>
    </div>
  );
}

function TranscriptSpeaker({
  initials,
  name,
  quote,
}: {
  initials: string;
  name: string;
  quote: string;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold">{name}</p>
        <p className="mt-0.5 text-[12px] leading-[1.45] text-muted-foreground">{quote}</p>
      </div>
    </div>
  );
}

function PreviewAction({
  label,
  icon: Icon,
  primary = false,
  quiet = false,
}: {
  label: string;
  icon?: typeof Check;
  primary?: boolean;
  quiet?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-8 cursor-default items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium select-none ${primary ? "bg-primary text-primary-foreground" : quiet ? "text-muted-foreground" : "border border-border bg-background"}`}
    >
      {Icon ? <Icon className="size-3" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}
