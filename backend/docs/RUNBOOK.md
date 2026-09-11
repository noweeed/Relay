# Deployment and worker runbook

## Start order

1. Provision MongoDB, Redis, private object storage, and the Atlas vector index.
2. Run any documented data migration, including `npm run migrate:kanban-columns` for databases created before custom columns.
3. Deploy the Node build with `npm start` and wait for `/health` to report `database.status: connected`.
4. Start one or more Python workers with `python -m relay_ai.worker`.
5. Deploy the frontend with its public API and Socket.IO URLs.

Node owns HTTP authorization, persistent writes, AI-result consumption, Socket.IO, and the deadline worker. Python consumes authorized AI jobs and publishes validated results. Both can be scaled independently; keep each Redis consumer name unique.

## Normal checks

- API health: `GET /health` returns 200.
- API contract: `GET /docs.json` returns the OpenAPI document.
- Redis from Python: `python -m relay_ai.worker --check-transport`.
- Worker logs show the consumer group active and jobs being acknowledged.
- Meetings move `created` → `processing` → `ready_for_review` or `failed`.
- Deadline scheduling logs the configured interval when enabled.

## A meeting is stuck processing

1. Confirm Redis is reachable from both processes and stream names match.
2. Confirm a Python worker is running with a unique consumer name.
3. Inspect pending entries in the AI job/result consumer groups. Abandoned entries are reclaimed after `AI_PENDING_IDLE_MS`.
4. Check provider status, credentials, quotas, and timeout logs.
5. Let the retry policy finish. A terminal failure changes the meeting to `failed` and writes the dead-letter stream.
6. After fixing the cause, use the owner/admin reprocess action. Audio reprocessing reuses the stored object.

Do not manually acknowledge or delete an entry until its durable result or dead-letter record is confirmed. Doing so can lose work.

## Result consumer or API restart

Stop the process with `SIGTERM`/`Ctrl+C` so Relay closes HTTP traffic, consumers, MongoDB, Redis, and BullMQ cleanly. On restart, the result consumer resumes its group and reclaims abandoned deliveries. The `AiJobLedger` makes result persistence idempotent, so safe redelivery does not duplicate candidates.

## Provider outage

Provider exceptions are retried with exponential backoff. If the outage lasts beyond the attempt budget, keep the failure and dead-letter evidence, restore the provider, then reprocess failed meetings. Do not bypass human review or write provider output directly to tasks.

## Key rotation and rollback

- Rotating JWT secrets invalidates existing access or refresh tokens; plan a user re-login window.
- Rotating `AUDIO_SIGNING_SECRET` invalidates outstanding short-lived local audio URLs but does not delete audio.
- Provider and storage keys can be rotated independently.
- Roll back API and worker together when changing shared job/result schema versions.

Back up MongoDB and private audio storage according to the hosting provider's recovery policy. Redis streams are transport state, not the only copy of accepted project data.

