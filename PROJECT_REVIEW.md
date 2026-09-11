# Relay project review — 2026-09-05

Reviewed the current working tree, including existing uncommitted changes, across the Express API, React frontend, Python AI worker, authorization, review/duplicate flows, realtime events, and dependencies. The original review made no application fixes. This is a source review with automated checks, not a complete penetration test or a live-provider certification.

## Fix status — 2026-09-05

All 10 findings below have now been fixed. Automated checks pass: 113 backend tests, 42 Python tests, backend/frontend type checks and lint, and the frontend production build. Backend and frontend production npm audits now report zero known vulnerabilities. Live multi-server socket deployment and live AI providers were not tested.

## Findings

### 1. P1 — Removed members retain realtime access

**Locations:** `backend/src/sockets/io.ts:45`, `backend/src/services/project.service.ts:369`, `backend/src/sockets/taskEvents.ts:8`.

Membership is checked when joining a project/meeting room. Removing a member only deletes the membership record; it does not evict that user's sockets. Later task broadcasts send full task data, including descriptions and source quotes, to everyone still in the project room. Token expiry is also only checked at connection time.

**Reproduction:** A real Socket.IO client joined a room, the actual removal service deleted a mocked membership, and the client still received a subsequent `task.updated` event. Database calls were mocked; the socket transport, removal service, and event emitter were real.

**Fix:** Evict affected sockets from both project and meeting rooms on membership revocation, disconnect on account deletion, and implement expiry/revalidation for long-lived sockets. Apply revocation across API instances if deployed with multiple instances.

### 2. P1 — Deadline notifications leak project changes after membership removal

**Locations:** `backend/src/services/deadline-monitor.service.ts:58`, `backend/src/services/notification.service.ts:35`, `backend/src/services/project.service.ts:369`.

The monitor chooses the task assignee, or task creator when unassigned, without checking current project membership. Removal leaves those task references intact. An ex-member with an active account can therefore receive newly generated notifications containing current task titles and deadlines. The notifications API checks ownership of the notification but not access to its project.

**Reproduction:** With membership removed, the real monitor still attempted to insert a notification for that user containing a confidential task title changed after removal. Database records were mocked.

**Fix:** Check recipient membership before creating notifications; decide how existing project notifications should behave after revocation. Reassign or clear removed members' task assignments as appropriate.

### 3. P2 — Deadline calculations use a permanently fixed date

**Location:** `frontend/src/lib/relay-data.ts:501`.

`TODAY` is fixed to `2026-08-23T10:00:00Z`. Both `isOverdue` and `dueThisWeek` use it. These functions feed dashboard counts and task-card overdue indicators.

**Reproduction:** `isOverdue({ due: '2026-09-01', status: 'todo' })` returns false, although the review date is September 5. The real helper was executed.

**Fix:** Use the current clock, define a consistent deadline/timezone policy with the backend, and refresh date-dependent UI when the day changes.

### 4. P2 — Notifications and dashboard activity still display demo data

**Locations:** `frontend/src/lib/relay-store.tsx:312`, `frontend/src/lib/relay-store.tsx:944`, `frontend/src/lib/relay-data.ts:452`, `frontend/src/routes/app.index.tsx:236`.

The notification panel starts from three hardcoded notifications. Mark-read actions only change React state. The frontend does not fetch `/notifications` or subscribe to `notification.created`, so actual backend deadline notifications never appear and read state resets after reload. The overview also renders a hardcoded activity feed with demo users and task names.

**Fix:** Connect notification list/read actions and socket events to the real API; render actual activity or an honest empty state.

### 5. P2 — Task boards do not receive other users' task changes

**Location:** `frontend/src/lib/relay-store.tsx:451`.

The frontend subscribes to `meeting.progress` only. The backend emits `task.created`, `task.updated`, and `task.deleted`, but there are no frontend listeners for these events. Task loading runs on project changes and explicit local refreshes, not on another member's edits. Two open clients therefore diverge after a task is created, moved, updated, approved, or deleted.

**Fix:** Subscribe to task events and update or invalidate the active board. Refresh state on reconnect, and supply the latest access token when reconnecting; the socket currently captures a single token at creation.

### 6. P2 — Duplicate detection misses manual tasks and uses stale embeddings after edits

**Locations:** `backend/src/services/task.service.ts:179`, `backend/src/services/task.service.ts:298`, `backend/src/services/task-candidate.service.ts:299`, `backend/ai-service/relay_ai/providers/mongo_atlas_search.py:65`.

Only extracted candidates receive embeddings, which approval copies onto tasks. Manual task creation has no embedding generation path. Task and candidate title/description edits do not refresh existing embeddings. Atlas similarity search uses only the embedding field, so manual tasks are absent from semantic matching and edited tasks can continue matching their old meanings.

**Evidence:** Traced every embedding reference in the Node services and the Atlas query. This was not tested against a live Atlas index.

**Fix:** Queue embedding generation on task creation and relevant content changes, including candidate edits, and backfill existing tasks. Version the embedded content so stale vectors are detectable.

### 7. P2 — Multiple AI workers can reclaim work that is still running

**Locations:** `backend/ai-service/relay_ai/config.py:27`, `backend/ai-service/relay_ai/redis_transport.py:112`, `backend/ai-service/relay_ai/redis_transport.py:128`, `backend/ai-service/relay_ai/worker.py:201`.

The default reclaim threshold is 30 seconds. Workers fetch up to ten messages and process them sequentially, without renewing pending-message ownership while processing or waiting in the local batch. Another worker can reclaim those messages while the original worker is still working. Provider timeouts alone can exceed 30 seconds. This can duplicate provider calls and costs, and competing failed/successful results can race to become the accepted result for one job.

**Evidence:** Source trace; no multi-worker load experiment was run.

**Fix:** Add renewable processing leases/heartbeats and avoid prefetching more jobs than a worker can actively own. Keep result persistence idempotent; that alone does not prevent duplicated provider execution.

### 8. P2 — Confirmed commands have a crash-recovery gap

**Location:** `backend/src/services/command.service.ts:130`.

Confirmation first stores `executing`, then updates the task in a separate transaction, then saves `completed`. A process crash before the mutation leaves an unexecuted command permanently executing; a crash after the task update leaves an executed command in that same state. Confirmation only accepts `awaiting_confirmation`, and cancellation excludes `executing`, so neither action recovers it. A final-save failure can also report failure after the mutation already committed.

**Evidence:** Source trace; no process-kill experiment was run.

**Fix:** Make task mutation, activity, and command completion atomic, or implement durable execution recovery with an idempotency key and explicit reconciliation.

### 9. P2 — Frontend type checking fails, while the build reports success

**Locations:** `frontend/src/components/relay/task-detail-panel.tsx:58`, `frontend/src/lib/relay-data.ts:389`, `frontend/src/lib/relay-store.tsx:134`, `frontend/src/lib/relay-store.tsx:454`, `frontend/package.json`.

The standalone TypeScript check reports nine diagnostics: an optional string assigned to a required field, five candidate fixtures missing `description`, two index-signature accesses using dot notation, and an optional meeting error field explicitly assigned `undefined`. The build runs Vite without a TypeScript check, so it does not catch these.

**Fix:** Correct the type mismatches and make `tsc --noEmit` a required frontend check.

### 10. Dependency maintenance — Moderate advisories in backend `qs`

**Location:** `backend/package-lock.json:5422`.

The production-only npm audit reports one vulnerable transitive package, `qs`, with two moderate advisories and a fix available:

- [Array-limit bypass via bracket-key comma parsing](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx)
- [Denial of service via attacker-controlled isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)

This establishes a vulnerable installed dependency, not a demonstrated exploitable Relay endpoint. No high or critical production npm advisories were reported. Frontend production npm audit reported zero known vulnerabilities.

**Fix:** Update the affected dependency through its parent or a compatible override, regenerate the lockfile, and rerun relevant request-parsing tests.

**Fixed:** Updated the transitive `qs` package from 6.15.3 to 6.16.0 in the backend lockfile. No forced or major dependency upgrade was needed.

## Verification

| Check | Result |
| --- | --- |
| Backend TypeScript | Passed |
| Backend ESLint | Passed |
| Backend tests, native config loader | 113 passed |
| Python pytest | 42 passed |
| Frontend production build | Passed |
| Frontend standalone TypeScript | Passed |
| Backend production npm audit | 0 known vulnerabilities |
| Frontend production npm audit | 0 known vulnerabilities |
| Regression coverage | Added for access revocation, notification recipients, embeddings, worker leases, and command recovery |

The backend suite uses Vite's native config loader to avoid temporary configuration bundle writes in restricted environments.

Reproduction script: `.tmp/review-checks.cjs`. It uses mocked database methods, temporary in-process state, and a localhost socket server; it does not connect to or alter application databases.

Not verified: deployed configuration, browser end-to-end interactions, real Groq/Gemini/S3/Atlas calls, multi-instance operation, Python dependency advisories, or exhaustive load/security testing.
