# Relay Development Progress

**Last updated:** September 3, 2026
**Current milestone:** v0.7 — Audio Meetings
**Overall status:** v0.6 complete; background meeting processing is durable, retryable, idempotent, and live-updating

This is the living implementation tracker. Update it when work begins, acceptance criteria change, or a milestone is completed.

## Status legend

- `[x]` Complete and verified
- `[~]` Implemented but awaiting an external dependency or acceptance check
- `[>]` Next planned work
- `[ ]` Future work

## Current implementation

### v0.1 — Backend Foundation

- [x] Node.js project initialized
- [x] TypeScript strict configuration
- [x] Express application factory
- [x] HTTP server entry point
- [x] MongoDB/Mongoose connection lifecycle
- [x] Zod environment validation
- [x] Pino structured logging and sensitive-field redaction
- [x] Helmet and project-origin CORS setup
- [x] Centralized 404 and error handling
- [x] Standard Relay error response contract
- [x] `GET /api`
- [x] `GET /health`
- [x] Swagger UI at `GET /docs`
- [x] OpenAPI JSON at `GET /docs.json`
- [x] Initial source/test/future-module directory structure
- [x] Workspace separated into organized `backend/` and `frontend/` boundaries
- [x] Python 3.12 AI-service package scaffold
- [x] Pydantic AI job and result envelope models
- [x] Language-neutral JSON Schema contracts
- [x] Independently runnable Python worker startup check
- [x] Root and AI-service setup documentation
- [x] npm dependency audit with zero known vulnerabilities at verification time
- [x] Confirm `/health` returns HTTP 200 against the intended MongoDB Atlas deployment

### Verification results

| Check                       | Result    |
| --------------------------- | --------- |
| `npm run typecheck`         | Passed    |
| `npm run lint`              | Passed    |
| `npm run build`             | Passed    |
| Node unit/integration tests | 34 passed |
| Python unit/schema tests    | 23 passed |
| Ruff                        | Passed    |
| mypy                        | Passed    |
| Python worker `--check`     | Passed    |
| Live Atlas connection       | Passed    |

## Immediate next actions

1. [x] Set up Redis Streams AI job/result transport.
2. [x] Build the LangGraph meeting extraction graph.
3. [x] Implement the LLM provider and structured extraction prompt.
4. [x] Connect meeting dispatch, Python worker execution, and Node result persistence.
5. [x] Add long-transcript chunking and reconciliation.
6. [x] Implement TaskCandidate review endpoints.
7. [x] Connect the frontend review queue to candidate endpoints.

## Milestone roadmap

### v0.2 — Authentication and Projects

- [x] User model with unique normalized email
- [x] Project model
- [x] Membership model and unique project/user index
- [x] RefreshSession model with TTL cleanup
- [x] Password hashing with bcrypt
- [x] Signup endpoint
- [x] Login endpoint
- [x] Short-lived JWT access tokens
- [x] Signed refresh JWT rotation with hashed server-side revocation state
- [x] Secure HTTP-only refresh cookie support
- [x] Logout endpoint
- [x] Current-user endpoint
- [x] Authentication middleware
- [x] Project CRUD
- [x] Owner/admin/member authorization rules
- [x] Project membership checks on every scoped endpoint
- [x] Existing-user invitation and member removal flow
- [x] Idempotent seed script
- [x] Authentication rate limiting
- [x] Validation, token, authorization, and HTTP-boundary tests
- [x] Signup → login → private project → invite → authorized access integration test
- [x] Repeat the acceptance flow against the intended MongoDB Atlas deployment

**Acceptance demo:** A user can register, log in, create a project, and retrieve only projects they belong to.

### v0.3 — Kanban Backend

- [x] Task model
- [x] TaskActivity model
- [x] Task CRUD
- [x] Custom owner/admin Kanban columns with stable IDs, ordering, colors, and reporting categories
- [x] Column, assignee, priority, due-date, and search filters
- [x] Dynamic grouped Kanban response including empty columns
- [x] Idempotent fixed-status-to-column migration
- [x] Task source traceability fields
- [x] Automatic activity entries for mutations
- [x] Project overview aggregation
- [x] Task realtime events (Socket.IO)
- [x] Authorization and integration tests

**Acceptance demo:** The Relay web frontend can run a complete manual Kanban board against Relay APIs.

### Frontend integration

- [x] Remove Lovable-specific runtime, telemetry, metadata, and branding assets
- [x] Replace the Lovable Vite wrapper with standard TanStack Start/Vite configuration
- [x] Real signup, login, refresh-cookie session restoration, and logout
- [x] Real project listing and project creation
- [x] Real task board and custom-column integration
- [x] Owner/admin board column creation with model-backed name, color, and category fields
- [x] Real member addition by email with editable, permission-safe team roles
- [x] Account profile, avatar, password, notification preferences, and guarded deletion APIs/UI
- [x] Existing-member project ownership transfer
- [x] Google Identity sign-in/sign-up flow
- [x] Real transcript meeting creation, listing, parsed detail, and linked-task integration
- [x] Real candidate review integration

### v0.4 — Transcript Meetings

- [x] Meeting model
- [x] TranscriptSegment model
- [x] Transcript meeting creation endpoint
- [x] Transcript parsing and normalization rules
- [x] Meeting list and detail endpoints
- [x] Transcript endpoint
- [x] Meeting status endpoint
- [x] Meeting-to-tasks endpoint
- [x] Reprocessing endpoint contract
- [x] Meeting access authorization tests

**Acceptance demo:** A project member can paste and later retrieve a stored meeting transcript.

### v0.5 — Python Extraction and Human Review

- [x] Redis Streams AI job/result transport
- [x] Matching Zod contracts in Node
- [x] Python Pydantic meeting schemas
- [x] LangGraph meeting graph
- [x] Transcript normalization node
- [x] LLM provider abstraction
- [x] Extraction prompt and structured output
- [x] Meeting creation/reprocessing job dispatch
- [x] Python Redis worker loop and LangGraph execution
- [x] Long-transcript chunking and reconciliation
- [x] Unambiguous assignee matching against project members
- [x] TaskCandidate model
- [x] Node result validation, stale-result rejection, and idempotent persistence
- [x] Candidate list/edit/approve/reject endpoints
- [x] Bulk approve/reject endpoints
- [x] Permanent task source traceability
- [x] AI provider mocks and contract fixtures

**Acceptance demo:** Paste transcript → extract review candidates → approve candidate → task appears on the board with its meeting source.

### v0.6 — Async Processing Hardening

- [x] Redis production configuration
- [x] Redis consumer groups
- [x] Independently deployed Python worker loop
- [x] Retry and backoff policy
- [x] Dead-letter stream
- [x] Node result consumer recovery
- [x] Idempotency ledger by `jobId`
- [x] Meeting status transition enforcement
- [x] Socket.IO authentication and project/meeting rooms
- [x] Processing progress events
- [x] Failure and redelivery tests

**Acceptance demo:** Meeting processing survives retries and emits live progress without holding the upload request open.

### v0.7 — Audio Meetings

- [x] Multipart upload endpoint
- [x] Audio MIME, container-signature, and size validation
- [x] Filename sanitization
- [ ] Cloudinary or S3-compatible storage adapter
- [x] Project-membership-secured audio access
- [ ] Python transcription provider abstraction
- [ ] Timestamped transcript segmentation
- [ ] Speaker labels without biometric identity claims
- [ ] Retry processing without re-upload
- [ ] Audio pipeline integration tests

**Acceptance demo:** Upload MP3/WAV/M4A → transcription → extraction → review.

### v0.8 — Duplicate Detection and Cross-Meeting Memory

- [ ] Python embedding provider abstraction
- [ ] Candidate and task embedding persistence
- [ ] Atlas Vector Search index and setup guide
- [ ] Project-scoped search over open tasks
- [ ] Configurable similarity thresholds
- [ ] Optional LLM duplicate verification
- [ ] DuplicateCandidate model
- [ ] Field-difference generation
- [ ] Duplicate resolution endpoint
- [ ] Update-existing action
- [ ] Create-separate action
- [ ] Ignore action
- [ ] Human confirmation enforcement
- [ ] Cross-meeting source activity

**Acceptance demo:** A second meeting mentions existing work with changed details, and Relay proposes updating the existing task.

### v0.9 — Notifications and Deadline Monitoring

- [ ] Notification model
- [ ] Notification preferences
- [ ] BullMQ deadline schedule
- [ ] Upcoming deadline detection
- [ ] Overdue detection
- [ ] Notification deduplication
- [ ] Notification list/read endpoints
- [ ] Realtime notification events
- [ ] Deadline and dedupe tests

**Acceptance demo:** Relay creates one appropriate notification for upcoming or overdue work without hourly duplicates.

### v0.10 — Natural-Language Commands

- [ ] CommandLog model
- [ ] Shared command intent contract
- [ ] Python command graph
- [ ] Project-context retrieval
- [ ] Task entity resolution
- [ ] Ambiguous-match responses
- [ ] Read-only query execution in Node
- [ ] Mutation preview and confirmation flow
- [ ] Cancel flow
- [ ] Authorized Node mutation execution
- [ ] Command activity logging
- [ ] Command parsing and confirmation tests

**Acceptance demo:** “Move authentication to done” produces a preview and changes the task only after confirmation.

### v0.11 — Integrations

- [ ] Integration model and encrypted credentials strategy
- [ ] Telegram connect/disconnect flow
- [ ] Telegram notification delivery
- [ ] Integration settings endpoints
- [ ] Delivery retry and failure handling

**Acceptance demo:** A user connects Telegram and receives selected Relay notifications.

### v1.0 — Portfolio Release

- [ ] Complete all required core milestones
- [ ] End-to-end first-meeting demo
- [ ] End-to-end cross-meeting update demo
- [ ] Project authorization security review
- [ ] Expensive-route rate limiting
- [ ] Provider failure and retry testing
- [ ] Critical integration test suite
- [ ] Swagger/OpenAPI coverage for public endpoints
- [ ] Production environment documentation
- [ ] Deployment and worker runbooks
- [ ] Logging/privacy configuration review
- [ ] Final README and demo dataset

**Acceptance demo:** Meeting one creates reviewed work; meeting two recognizes and proposes an update to that work; the human confirms it and can inspect the complete source history.

## Product decisions still required

- [ ] Initial LLM provider and model
- [ ] Initial embedding provider and model
- [ ] Initial transcription provider
- [ ] Cloudinary versus S3-compatible audio storage
- [ ] Refresh-token persistence and revocation details
- [ ] Invitation acceptance mechanics
- [ ] Transcript speaker-format conventions
- [ ] Project timezone and relative-date rules
- [ ] Exact field merge policy for `update_existing`
- [ ] Notification recipient and preference defaults

## Progress update rules

When updating this file:

1. Mark work complete only after relevant verification passes.
2. Record external acceptance gaps with `[~]`, not `[x]`.
3. Keep the current milestone and immediate next actions accurate.
4. Add newly discovered requirements to the appropriate future milestone.
5. Do not silently remove deferred work; explain scope changes in a note.
6. Keep implementation status here and architectural intent in `Relay_PRD.md`.
