# Relay

Relay turns meetings into reviewable, traceable project work.

## Project layout

```text
Relay/
├── backend/             Node API, Python AI worker, tests, and contracts
├── frontend/            Lovable frontend handoff area
├── Relay_PRD.md         Product and architecture requirements
├── FLOW.md              Runtime and feature flows
├── PROGRESS.md          Current status and future roadmap
└── graphify-out/        Generated knowledge-graph artifacts
```

Start backend work in [`backend/README.md`](backend/README.md). The frontend is maintained separately with Lovable; its boundary and expected integration are documented in [`frontend/README.md`](frontend/README.md).

## Project documents

- [`Relay_PRD.md`](Relay_PRD.md) — product and architecture requirements
- [`FLOW.md`](FLOW.md) — runtime and feature flows
- [`PROGRESS.md`](PROGRESS.md) — current implementation and future milestones
- [`graphify-out/graph.html`](graphify-out/graph.html) — interactive codebase graph

## What is `dist`?

`backend/dist/` is generated output. TypeScript source in `backend/src/` cannot be executed directly by a normal production Node process, so `npm run build` compiles it to JavaScript in `backend/dist/`.

You edit `backend/src/`. You do not manually edit `backend/dist/`. The directory is ignored by Git and can always be regenerated with `npm run build`.
