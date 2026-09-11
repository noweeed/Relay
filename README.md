# Relay

Relay turns meetings into reviewable, traceable project work.

Relay accepts pasted transcripts and MP3/WAV/M4A meetings, processes them asynchronously through Redis and a Python LangGraph worker, safely chunks long transcripts, persists evidence-backed candidates, and lets project members edit, approve, reject, or bulk-review them. Audio can use local or S3-compatible storage and Groq Whisper transcription. Approved tasks retain their meeting, transcript segment, quote, and timestamp source.

The v0.8 path also embeds extracted work and searches the same project's open tasks for likely repeats. Relay shows the match to a human and waits for an explicit Update existing, Create separate, or Ignore choice; AI never silently merges tasks.

The v0.9 Node worker monitors open task due dates on a BullMQ schedule, honors each recipient's notification preferences, and creates private upcoming or overdue notifications. Atomic due-date-aware deduplication prevents hourly repeats, and authenticated clients can list/read notifications or receive `notification.created` over Socket.IO.

The v0.10 command bar now uses the real Python LangGraph interpreter and Node confirmation lifecycle. It supports task moves, assignments, and overdue queries, returns ambiguous matches without guessing, and performs state changes only after an explicit confirmation.

The v1.0 release hardens costly AI routes with per-user limits, protects cookie-auth mutations from untrusted browser origins, removes signed query strings and credentials from logs, documents every public endpoint, and includes production/deployment guidance plus a deterministic two-meeting portfolio demo. The only environment-owned release step is deploying the supplied Atlas Vector Search index.

## Project layout

```text
Relay/
├── backend/             Node API, Python AI worker, tests, and contracts
├── frontend/            Relay TanStack web application
├── Relay_PRD.md         Product and architecture requirements
├── LEARNING_ORDER.md    Beginner-friendly file-by-file study path
├── FLOW.md              Runtime and feature flows
├── PROGRESS.md          Current status and future roadmap
└── graphify-out/        Generated knowledge-graph artifacts
```

Start backend work in [`backend/README.md`](backend/README.md). Frontend setup and integration notes are documented in [`frontend/README.md`](frontend/README.md).

## Project documents

- [`Relay_PRD.md`](Relay_PRD.md) — product and architecture requirements
- [`LEARNING_ORDER.md`](LEARNING_ORDER.md) — recommended order for learning every implemented file
- [`FLOW.md`](FLOW.md) — runtime and feature flows
- [`PROGRESS.md`](PROGRESS.md) — current implementation and future milestones
- [`backend/docs/PRODUCTION.md`](backend/docs/PRODUCTION.md) — production configuration and release checks
- [`backend/docs/RUNBOOK.md`](backend/docs/RUNBOOK.md) — deployment, worker recovery, and rollback operations
- [`backend/docs/SECURITY_PRIVACY.md`](backend/docs/SECURITY_PRIVACY.md) — security controls and privacy review
- [`backend/demo/portfolio-demo.json`](backend/demo/portfolio-demo.json) — first-meeting and cross-meeting demo inputs
- [`graphify-out/graph.html`](graphify-out/graph.html) — interactive codebase graph

## What is `dist`?

`backend/dist/` is generated output. TypeScript source in `backend/src/` cannot be executed directly by a normal production Node process, so `npm run build` compiles it to JavaScript in `backend/dist/`.

You edit `backend/src/`. You do not manually edit `backend/dist/`. The directory is ignored by Git and can always be regenerated with `npm run build`.
