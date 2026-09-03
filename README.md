# Relay

Relay turns meetings into reviewable, traceable project work.

The v0.5 path accepts transcript meetings, processes them asynchronously through Redis and a Python LangGraph worker, safely chunks long transcripts, persists evidence-backed candidates, and lets project members edit, approve, reject, or bulk-review them. Approved tasks retain their meeting, transcript segment, quote, and timestamp source.

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
- [`graphify-out/graph.html`](graphify-out/graph.html) — interactive codebase graph

## What is `dist`?

`backend/dist/` is generated output. TypeScript source in `backend/src/` cannot be executed directly by a normal production Node process, so `npm run build` compiles it to JavaScript in `backend/dist/`.

You edit `backend/src/`. You do not manually edit `backend/dist/`. The directory is ignored by Git and can always be regenerated with `npm run build`.
