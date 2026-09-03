# Relay — Backend & AI PRD

**Multi-Agent Meeting-to-Task Platform**  
**Node Application Backend + Python AI Worker Specification**

**Version:** 2.1  
**Date:** August 24, 2026  
**Frontend:** Built separately with Lovable  
**Backend:** Node.js + Express + MongoDB Atlas  
**AI Worker:** Python 3.12+ + LangGraph  

---

# 1. Purpose

Relay turns meetings into structured, trackable work.

The user-facing flow is:

**Meeting → Transcription → Task Extraction → Human Review → Kanban Board → Cross-Meeting Tracking**

The frontend will be generated and maintained separately in **Lovable**. This repository is therefore focused entirely on the **backend, database, APIs, Python AI worker, async processing, integrations, and business logic** required by that frontend.

The Node backend must expose a stable REST API so the Lovable frontend can remain mostly presentation-focused. Authentication, authorization, persistence, task approval, duplicate-resolution decisions, notifications, and command execution remain in Node. AI reasoning, provider calls, and multi-step agent orchestration run in a separate Python worker. The frontend never calls the Python worker directly.

### Out of scope initially

- Building the frontend UI
- Billing/subscriptions
- Enterprise SSO
- Native mobile applications
- Real-time audio streaming
- Voice-to-voice agents
- Complex organization/workspace hierarchy
- Automatic task updates without human confirmation

---

# 2. Product Goals

1. Accept a pasted transcript or uploaded meeting recording.
2. Convert meeting content into timestamped transcript segments.
3. Extract concrete, structured task candidates using an AI agent.
4. Allow humans to approve, edit, or reject extracted tasks before they reach the board.
5. Preserve traceability between every extracted task and its source meeting/transcript segment.
6. Detect when a new meeting refers to work that already exists.
7. Allow humans to update the existing task, create a separate task, or ignore the candidate.
8. Maintain normal Kanban task management independently of AI extraction.
9. Monitor deadlines and generate notifications.
10. Support natural-language project commands such as "Move authentication to Done".
11. Keep the frontend thin: it should render state and call APIs rather than implement business logic.

---

# 3. Technology Stack

The technology stack is intentionally fixed for this implementation.

| Layer | Technology |
|---|---|
| Application runtime | Node.js |
| Application language | TypeScript |
| HTTP API | Express.js |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Vector Search | MongoDB Atlas Vector Search |
| Authentication | JWT access + refresh tokens |
| Password hashing | bcrypt |
| Node validation | Zod |
| Node async jobs | BullMQ |
| Node/Python job transport | Redis Streams with consumer groups |
| Queue backend | Redis |
| File storage | Cloudinary or S3-compatible object storage |
| Realtime | Socket.IO |
| AI runtime | Python 3.12+ |
| AI orchestration | LangGraph |
| Python validation | Pydantic |
| LLM | Python provider abstraction; initially Gemini / Claude / OpenAI-compatible model |
| Embeddings | Python provider abstraction; persisted by Node in MongoDB Atlas |
| Speech-to-text | Python provider abstraction for a Whisper-compatible API |
| Logging | Pino |
| AI logging | Python structured logging |
| API docs | Swagger / OpenAPI |
| Node testing | Vitest or Jest + Supertest |
| Python testing | pytest |

### Runtime boundary

Node/TypeScript remains Relay's authoritative application layer. Python is not a replacement backend and does not expose frontend-facing routes.

For the initial implementation, do not add FastAPI. Node and Python communicate through durable Redis job and result streams. FastAPI may be introduced later only if a concrete deployment or scaling requirement justifies an internal HTTP interface.

BullMQ remains available for Node-owned scheduled and background work. Cross-runtime AI jobs use Redis Streams because Python must not depend on BullMQ's private Redis representation or an unofficial compatibility layer.

### Why MongoDB Atlas

MongoDB is the primary system of record for Relay.

It stores:

- users
- projects
- memberships
- meetings
- transcript segments
- extracted task candidates
- approved tasks
- task activity
- duplicate resolutions
- notifications
- command logs
- integrations

MongoDB Atlas Vector Search is also used for task embeddings and semantic similarity, removing the need to operate a separate vector database for the first version of Relay.

---

# 4. High-Level Architecture

```text
Lovable Frontend
      |
      | HTTPS REST / JSON
      | Socket.IO events
      v
+-----------------------------------+
|     Node.js / Express API         |
|                                   |
| Auth / Validation / Routes        |
| Controllers / Business Services  |
| Persistence / Realtime Events     |
+----------------+------------------+
                 |
      +----------+-----------+
      |                      |
      v                      v
 MongoDB Atlas             Redis
 System of record     BullMQ + AI Streams
      ^                      |
      |                      v
      |             +--------------------+
      +-------------| Python AI Worker   |
       read context | LangGraph / Agents |
       return result| LLM / STT / Embed  |
                    +---------+----------+
                              |
                              v
                       Object Storage
                        Meeting Audio
```

### Backend responsibility

The backend owns:

- authentication
- authorization
- project membership rules
- meeting persistence
- upload handling
- submission and tracking of AI jobs
- validation and persistence of AI results
- task candidate state
- candidate approval/rejection
- duplicate-resolution business rules
- task CRUD
- activity history
- deadline monitoring
- notifications
- command confirmation and execution
- integrations
- realtime events

### Python AI worker responsibility

The Python worker owns:

- LangGraph state and orchestration
- transcription/STT provider calls
- transcript normalization for AI processing
- task extraction reasoning
- assignee suggestion against supplied project members
- embeddings and semantic duplicate search
- optional LLM duplicate verification
- cross-meeting comparison and proposed changes
- natural-language command interpretation and entity matching
- strict Pydantic validation of AI state and outputs

The Python worker returns structured proposals. It does not approve candidates, merge tasks, execute mutations, authorize users, or produce frontend API responses.

### Data ownership and mutation rule

Node is the only general writer to Relay's application collections. Python may read narrowly scoped meeting, member, and task context when processing an authorized job, including read-only Atlas Vector Search. Python returns transcript segments, embeddings, candidates, duplicate matches, or command interpretations through the result stream; Node revalidates and persists them.

Every AI job must contain an immutable `jobId`, `jobType`, `schemaVersion`, `projectId`, initiating `userId`, resource identifiers, and correlation metadata. Every result must repeat those identifiers and include either a versioned structured payload or a sanitized error. Node verifies that the referenced resources still belong to the project before applying a result.

### Frontend responsibility

Lovable owns:

- screens
- navigation
- forms
- Kanban interactions
- loading states
- visual review UI
- transcript viewer
- notifications UI
- theme and responsive styling

The frontend must not make direct database calls.

---

# 5. Core Domain Model

## 5.1 User

Represents an authenticated Relay user.

```ts
User {
  _id: ObjectId
  name: string
  email: string
  passwordHash: string
  avatarUrl?: string
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```text
email UNIQUE
```

---

## 5.2 Project

A workspace containing members, meetings, and tasks.

```ts
Project {
  _id: ObjectId
  name: string
  description?: string
  kanbanColumns: Array<{
    id: string // stable UUID
    name: string
    color: string // six-digit hex
    category: "todo" | "in_progress" | "done"
    order: number
  }>
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

---

## 5.3 Membership

Links users to projects.

```ts
Membership {
  _id: ObjectId
  projectId: ObjectId
  userId: ObjectId
  role: "owner" | "admin" | "member"
  createdAt: Date
}
```

Indexes:

```text
{ projectId, userId } UNIQUE
```

---

## 5.4 Meeting

```ts
Meeting {
  _id: ObjectId
  projectId: ObjectId
  title: string

  sourceType: "audio" | "transcript"

  audioUrl?: string
  audioStorageKey?: string
  durationSeconds?: number

  meetingDate: Date

  status:
    | "uploaded"
    | "transcribing"
    | "identifying_speakers"
    | "extracting"
    | "checking_duplicates"
    | "preparing_review"
    | "ready_for_review"
    | "reviewed"
    | "failed"

  currentStep?: string
  failureReason?: string

  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

---

## 5.5 Transcript Segment

One ordered speaker turn from a meeting.

```ts
TranscriptSegment {
  _id: ObjectId
  meetingId: ObjectId
  projectId: ObjectId

  speakerLabel: string
  startMs?: number
  endMs?: number
  text: string
  orderIndex: number

  createdAt: Date
}
```

Indexes:

```text
{ meetingId, orderIndex }
```

---

## 5.6 Task Candidate

An AI-proposed action item that has not necessarily become a real task yet.

```ts
TaskCandidate {
  _id: ObjectId
  projectId: ObjectId
  meetingId: ObjectId
  segmentId?: ObjectId

  title: string
  description?: string

  suggestedAssigneeId?: ObjectId
  suggestedDueDate?: Date
  suggestedPriority: "low" | "medium" | "high"

  sourceQuote: string

  confidence?: number // internal only

  status:
    | "pending"
    | "approved"
    | "rejected"
    | "duplicate_pending"

  createdTaskId?: ObjectId

  embedding?: number[]

  createdAt: Date
  updatedAt: Date
}
```

Raw confidence must not be exposed to normal frontend responses.

---

## 5.7 Task

```ts
Task {
  _id: ObjectId
  projectId: ObjectId

  title: string
  description?: string

  assigneeId?: ObjectId
  dueDate?: Date

  priority: "low" | "medium" | "high"
  columnId: string // stable project Kanban column UUID

  source?: {
    meetingId: ObjectId
    segmentId?: ObjectId
    quote?: string
    timestampMs?: number
  }

  embedding?: number[]

  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

A task created from meeting extraction must retain its source information even if its title, description, due date, or assignee later changes.

---

## 5.8 Task Activity

```ts
TaskActivity {
  _id: ObjectId
  projectId: ObjectId
  taskId: ObjectId

  actorId?: ObjectId
  actorType: "user" | "agent" | "system"

  type:
    | "created"
    | "extracted"
    | "approved"
    | "column_changed"
    | "deadline_changed"
    | "assignee_changed"
    | "priority_changed"
    | "duplicate_resolved"

  fromValue?: unknown
  toValue?: unknown

  createdAt: Date
}
```

---

## 5.9 Duplicate Candidate

```ts
DuplicateCandidate {
  _id: ObjectId
  projectId: ObjectId

  taskCandidateId: ObjectId
  existingTaskId: ObjectId

  similarityLabel: "medium" | "high"
  similarityScore: number // internal only

  differences: {
    title?: { existing: string, candidate: string }
    dueDate?: { existing?: Date, candidate?: Date }
    assigneeId?: { existing?: ObjectId, candidate?: ObjectId }
    priority?: { existing?: string, candidate?: string }
  }

  resolution:
    | "pending"
    | "updated_existing"
    | "created_separate"
    | "ignored"

  resolvedBy?: ObjectId
  resolvedAt?: Date

  createdAt: Date
}
```

---

## 5.10 Notification

```ts
Notification {
  _id: ObjectId
  userId: ObjectId
  projectId?: ObjectId

  type:
    | "deadline_upcoming"
    | "task_overdue"
    | "meeting_ready_for_review"
    | "task_assigned"
    | "duplicate_detected"

  title: string
  body: string

  relatedTaskId?: ObjectId
  relatedMeetingId?: ObjectId

  readAt?: Date
  dedupeKey?: string

  createdAt: Date
}
```

---

## 5.11 Command Log

```ts
CommandLog {
  _id: ObjectId
  projectId: ObjectId
  userId: ObjectId

  inputText: string
  interpretedAction: Record<string, unknown>

  status:
    | "pending_confirmation"
    | "confirmed"
    | "cancelled"
    | "executed"
    | "failed"

  createdAt: Date
  updatedAt: Date
}
```

---

# 6. Authentication & Authorization

## Authentication

Use:

- email/password signup
- bcrypt password hashing
- short-lived JWT access token
- refresh token
- refresh token stored in secure `httpOnly` cookie where deployment allows it

Endpoints:

```http
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

## Project roles

### Owner

- full project access
- manage members
- change project settings
- connect integrations
- delete project

### Admin

- manage meetings/tasks
- review extracted tasks
- manage project members
- use integrations

### Member

- create/edit tasks
- upload meetings
- review candidates
- use command bar

Every project-scoped endpoint must verify membership server-side.

Never trust a `projectId` just because the frontend sent it.

---

# 7. REST API

All frontend-facing API endpoints use this base path:

```text
/api
```

Relay intentionally does not include a version segment in its API URLs. Contract changes must therefore remain backward-compatible with the frontend or be coordinated with a frontend update.

---

## 7.1 Projects

```http
POST   /api/projects
GET    /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId
```

Members:

```http
GET    /api/projects/:projectId/members
POST   /api/projects/:projectId/members/invite
DELETE /api/projects/:projectId/members/:userId
```

---

## 7.2 Dashboard

```http
GET /api/projects/:projectId/overview
```

Example response:

```json
{
  "stats": {
    "open": 12,
    "inProgress": 4,
    "dueThisWeek": 3,
    "overdue": 2
  },
  "upcomingDeadlines": [],
  "recentMeetings": [],
  "recentActivity": []
}
```

Keep this aggregated endpoint so Lovable does not need multiple requests just to render the dashboard.

---

## 7.3 Tasks / Kanban

```http
GET    /api/projects/:projectId/kanban/columns
POST   /api/projects/:projectId/kanban/columns
PATCH  /api/projects/:projectId/kanban/columns/:columnId
PUT    /api/projects/:projectId/kanban/columns/order
DELETE /api/projects/:projectId/kanban/columns/:columnId

GET    /api/projects/:projectId/tasks
POST   /api/projects/:projectId/tasks
GET    /api/projects/:projectId/tasks/:taskId
PATCH  /api/projects/:projectId/tasks/:taskId
DELETE /api/projects/:projectId/tasks/:taskId
GET    /api/projects/:projectId/tasks/:taskId/activity
```

Filters:

```text
?columnId=
?assignee=
?priority=
?q=
```

Board-specific request:

```http
GET /api/projects/:projectId/tasks?groupBy=column
```

Response:

```json
{
  "columns": [
    {
      "id": "stable-column-uuid",
      "name": "Code Review",
      "color": "#A855F7",
      "category": "in_progress",
      "order": 1,
      "tasks": []
    }
  ]
}
```

New projects receive Todo, In Progress, and Done columns. Owners/admins may fully configure the board, but at least one Todo-category column must remain. Deleting a populated column requires a same-project destination and moves its tasks atomically. Task mutations must automatically generate relevant `TaskActivity` entries.

---

# 8. Meeting APIs

## Transcript path

This path should be implemented before audio processing because it allows the complete AI workflow to be developed without transcription complexity.

```http
POST /api/projects/:projectId/meetings/transcript
```

Body:

```json
{
  "title": "Weekly Product Sync",
  "meetingDate": "2026-08-24",
  "transcriptText": "..."
}
```

---

## Audio path

```http
POST /api/projects/:projectId/meetings/audio
```

Multipart upload.

The server:

1. validates file type and size
2. stores audio externally
3. creates the meeting record
4. queues processing
5. returns immediately

Do not keep the request open while AI processing happens.

---

## Meeting access

```http
GET  /api/projects/:projectId/meetings
GET  /api/projects/:projectId/meetings/:meetingId
GET  /api/projects/:projectId/meetings/:meetingId/transcript
GET  /api/projects/:projectId/meetings/:meetingId/tasks
GET  /api/projects/:projectId/meetings/:meetingId/status
POST /api/projects/:projectId/meetings/:meetingId/reprocess
```

---

# 9. Meeting Processing Pipeline

```text
Meeting created
      |
      v
Node publishes versioned AI job
      |
      v
Python LangGraph worker loads context
      |
      v
[Audio?] -- yes --> Transcription
      |
      v
Normalize transcript / speaker segments
      |
      v
Extract candidates / match assignees
      |
      v
Generate embeddings / detect duplicates
      |
      v
Return structured result to Node
      |
      v
Node validates and persists result
      |
      v
READY FOR REVIEW
```

Pipeline state is persisted by Node on the `Meeting` document. LangGraph state is execution state, not an independent source of truth for application records.

Jobs and result application must be idempotent. Redis consumer groups provide delivery and retry, but Node must record the applied `jobId` so a redelivered result cannot create duplicate transcript segments, candidates, activities, or notifications.

The worker must use bounded retries for provider failures and emit a terminal sanitized failure result when retries are exhausted. Reprocessing creates a new job attempt without requiring the source audio to be uploaded again.

The backend emits realtime progress events through Socket.IO.

Example:

```json
{
  "event": "meeting.processing.updated",
  "meetingId": "...",
  "status": "extracting",
  "currentStep": "Extracting action items"
}
```

If Socket.IO is temporarily unavailable, Lovable can poll:

```http
GET /api/projects/:projectId/meetings/:meetingId/status
```

---

# 10. Python AI System

All AI-specific implementation lives in the Python `ai-service`. Relay uses focused LangGraph nodes, prompts, and services rather than one giant prompt or unnecessary wrapper classes labeled as agents.

LangGraph coordinates workflows that benefit from explicit state transitions, branching, retries, and reconciliation. Deterministic transformations remain ordinary Python functions or services.

## 10.1 Meeting graph

Conceptual graph:

```text
START
  |
  v
load meeting/context
  |
  v
transcribe (audio only)
  |
  v
normalize transcript
  |
  v
extract task candidates
  |
  v
match assignees
  |
  v
generate embeddings / detect duplicates
  |
  v
prepare review result
  |
  v
END
```

Graph input and output schemas are versioned Pydantic models. Node also validates returned results with matching Zod schemas before persistence.

### Transcription service

### Input

Meeting audio file.

### Output

```ts
{
  fullText: string
  segments: Array<{
    speaker?: string
    startMs?: number
    endMs?: number
    text: string
  }>
}
```

Requirements:

- timestamps where provider supports them
- preserve source audio on provider failure
- safe retry
- provider implementation hidden behind a Python interface

---

## 10.2 Speaker segmentation

In v1, Relay does not attempt voice biometric identification.

Use labels such as:

```text
Speaker 1
Speaker 2
Speaker 3
```

If the transcript itself clearly contains someone's name, the extraction agent may suggest a known project member, but it must not claim voice identification certainty.

---

## 10.3 Task extraction agent

### Input

- meeting date
- project member names
- ordered transcript segments

### Output

Strict structured data validated by Pydantic in Python and Zod again at the Node trust boundary.

Example:

```json
{
  "tasks": [
    {
      "title": "Finish authentication API",
      "description": null,
      "assigneeName": "Naveed",
      "dueDate": "2026-08-28",
      "priority": "high",
      "segmentOrder": 14,
      "sourceQuote": "I'll finish the authentication API by Friday."
    }
  ]
}
```

### Rules

The agent must:

- extract only concrete action items
- not invent a person
- not invent a deadline
- resolve relative dates using the meeting date
- use `null` when information is unknown
- connect each candidate to evidence in the transcript
- return structured JSON only

If the transcript is too large for one context window:

1. split transcript into logical chunks
2. extract candidates per chunk
3. run a reconciliation step
4. remove repeated candidates
5. persist final candidates

The Python worker performs steps 1–4 and returns the reconciled result. Node performs step 5.

The v0.5 implementation uses a configurable normalized-character budget, retains a small whole-segment overlap for boundary context, and bounds concurrent chunk calls. Reconciliation is deterministic: exact repeated evidence or an identical normalized action identity collapses to one candidate, preferring the highest-confidence and most complete result while retaining verbatim source traceability.

## 10.4 Duplicate detection agent

The duplicate workflow creates candidate embeddings, performs project-scoped read-only Atlas Vector Search against open tasks, and optionally uses an LLM to classify likely matches as `same_work`, `related_but_separate`, or `unrelated`. It returns proposed matches and field differences to Node. It never merges or updates a task.

## 10.5 Command graph

The command graph interprets natural language, retrieves or receives project-scoped context, resolves entities, and returns a structured intent, candidate matches, confirmation requirement, and preview. Node owns the command log, authorization, confirmation lifecycle, and execution.

---

# 11. Candidate Review

```http
GET   /api/projects/:projectId/meetings/:meetingId/candidates
PATCH /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId
POST  /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId/approve
POST  /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId/reject
POST  /api/projects/:projectId/meetings/:meetingId/candidates/bulk-approve
POST  /api/projects/:projectId/meetings/:meetingId/candidates/bulk-reject
```

Approval creates a real `Task` only after duplicate resolution requirements are satisfied.

A rejected candidate remains stored for audit/debugging instead of being immediately deleted.

---

# 12. Duplicate Detection Agent

This is a major differentiating feature of Relay.

Example:

Existing board task:

```text
Complete authentication backend
Due: Aug 25
```

New meeting candidate:

```text
Finish authentication API
Due: Aug 28
```

Relay should recognize that these may represent the same piece of work.

## Step 1 — Embedding

Create an embedding from:

```text
candidate.title + candidate.description
```

Python generates it and returns it with the structured result. Node stores it on the candidate.

Tasks also maintain embeddings.

## Step 2 — Atlas Vector Search

The Python worker performs a read-only search restricted to the job's project. Node verifies project scope again before persisting any returned duplicate proposal.

Initially compare against:

```text
todo
in_progress
```

Do not compare closed tasks in the first implementation unless later testing shows value.

## Step 3 — Candidate threshold

Example starting thresholds:

```text
>= 0.87  -> high
0.75-0.87 -> medium
< 0.75   -> not flagged
```

These values are configuration, not permanent business constants.

## Step 4 — Optional LLM verification

For medium/high vector matches, the Python duplicate agent compares the two tasks and classifies whether they represent:

```text
same_work
related_but_separate
unrelated
```

This provides better precision than using cosine similarity alone.

## Step 5 — Human decision

Relay never automatically merges tasks.

Endpoint:

```http
POST /api/projects/:projectId/duplicates/:duplicateId/resolve
```

Body:

```json
{
  "action": "update_existing"
}
```

Actions:

```text
update_existing
create_separate
ignore
```

---

# 13. Cross-Meeting Task Updates

This is where Relay becomes more than a meeting summarizer.

Suppose Meeting A creates:

```text
Task: Finish authentication API
Status: Todo
Due: Aug 25
```

Meeting B later says:

```text
"Authentication is almost finished. Naveed will deliver it Monday instead."
```

The extraction + duplicate pipeline should identify the existing task and propose:

```text
Existing due date: Aug 25
Meeting suggests: Aug 31
```

The user can then choose:

```text
Update existing
Create separate
Ignore
```

No silent mutation is allowed.

---

# 14. Natural-Language Command Agent

Endpoint:

```http
POST /api/projects/:projectId/commands
```

Example:

```json
{
  "text": "Move authentication to done"
}
```

Python command graph output returned to Node:

```json
{
  "intent": "update_task_status",
  "taskId": "...",
  "targetStatus": "done",
  "requiresConfirmation": true,
  "preview": "Move ‘Finalize authentication flow’ from In Progress to Done?"
}
```

State-changing actions are never executed by Python and are never executed immediately. Node validates the interpreted target, stores the `CommandLog`, and waits for confirmation.

Confirm:

```http
POST /api/projects/:projectId/commands/:commandId/confirm
```

Cancel:

```http
POST /api/projects/:projectId/commands/:commandId/cancel
```

Read-only commands may execute directly.

Example:

```text
What tasks are overdue?
```

Ambiguous entity references return candidate matches rather than guessing.

---

# 15. Background Jobs and Cross-Runtime Transport

BullMQ handles Node-only scheduled/background jobs. Redis Streams with consumer groups carry versioned AI job and result envelopes between Node and the independently running Python worker.

Node BullMQ queues:

```text
notifications
deadline-monitor
```

Cross-runtime streams:

```text
relay:ai:jobs
relay:ai:results
relay:ai:dead-letter
```

Supported initial `jobType` values:

```text
meeting.process
meeting.reprocess
command.interpret
```

Node publishes jobs only after authentication, authorization, and input validation. Python acknowledges a job only after publishing its result or terminal failure. Node applies results transactionally where practical and deduplicates by `jobId`.

Do not make Python consume BullMQ's internal Redis keys directly.

## Deadline monitor

Runs periodically.

Checks:

```text
due soon
past due
status != done
```

Creates deduplicated notifications.

Deadline checks are deterministic business logic and remain in Node. A Python model may later help phrase summaries, but it must not decide whether a task is overdue or who receives a notification.

Do not create the same notification every hour.

Suggested `dedupeKey`:

```text
${userId}:${taskId}:${notificationType}:${dueDate}
```

---

# 16. Realtime Events

Socket.IO events:

```text
meeting.processing.updated
meeting.ready_for_review
notification.created
task.created
task.updated
task.deleted
task.activity.created
duplicate.detected
```

Suggested project room:

```text
project:${projectId}
```

Suggested meeting room:

```text
meeting:${meetingId}
```

The socket connection must authenticate the user before joining project rooms.

---

# 17. Error Contract

All API errors use one consistent shape.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Enter a valid email address.",
    "fields": {
      "email": "Enter a valid email address."
    }
  }
}
```

Common codes:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
UPLOAD_FAILED
PROCESSING_FAILED
RATE_LIMITED
INTERNAL_ERROR
```

Never expose stack traces or provider secrets to Lovable.

---

# 18. API Response Convention

Success:

```json
{
  "success": true,
  "data": {}
}
```

Paginated list:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

This convention should remain consistent across the whole backend.

---

# 19. Backend Folder Structure

Workspace-level layout:

```text
relay/
|-- backend/       # Node API, Python worker, shared contracts, and backend tests
|-- frontend/      # Lovable frontend handoff/source area
|-- Relay_PRD.md
|-- FLOW.md
|-- PROGRESS.md
`-- README.md
```

The detailed tree below is rooted at `backend/`:

```text
relay/backend/
|
|-- src/
|   |
|   |-- app.ts
|   |-- server.ts
|   |
|   |-- config/
|   |   |-- env.ts
|   |   |-- database.ts
|   |   |-- redis.ts
|   |   |-- logger.ts
|   |   `-- swagger.ts
|   |
|   |-- models/
|   |   |-- User.model.ts
|   |   |-- Project.model.ts
|   |   |-- Membership.model.ts
|   |   |-- Meeting.model.ts
|   |   |-- TranscriptSegment.model.ts
|   |   |-- TaskCandidate.model.ts
|   |   |-- Task.model.ts
|   |   |-- TaskActivity.model.ts
|   |   |-- DuplicateCandidate.model.ts
|   |   |-- Notification.model.ts
|   |   |-- CommandLog.model.ts
|   |   `-- Integration.model.ts
|   |
|   |-- routes/
|   |   |-- index.ts
|   |   |-- auth.routes.ts
|   |   |-- project.routes.ts
|   |   |-- task.routes.ts
|   |   |-- meeting.routes.ts
|   |   |-- candidate.routes.ts
|   |   |-- duplicate.routes.ts
|   |   |-- command.routes.ts
|   |   |-- notification.routes.ts
|   |   `-- integration.routes.ts
|   |
|   |-- controllers/
|   |   |-- auth.controller.ts
|   |   |-- project.controller.ts
|   |   |-- task.controller.ts
|   |   |-- meeting.controller.ts
|   |   |-- candidate.controller.ts
|   |   |-- duplicate.controller.ts
|   |   |-- command.controller.ts
|   |   |-- notification.controller.ts
|   |   `-- integration.controller.ts
|   |
|   |-- services/
|   |   |-- auth.service.ts
|   |   |-- project.service.ts
|   |   |-- task.service.ts
|   |   |-- meeting.service.ts
|   |   |-- candidate.service.ts
|   |   |-- duplicate.service.ts
|   |   |-- notification.service.ts
|   |   |-- command.service.ts
|   |   |-- storage.service.ts
|   |   `-- integration.service.ts
|   |
|   |-- jobs/
|   |   |-- queues.ts
|   |   |-- notification.job.ts
|   |   `-- deadline-monitor.job.ts
|   |
|   |-- workers/
|   |   |-- index.ts
|   |   `-- notification.worker.ts
|   |
|   |-- ai-transport/
|   |   |-- ai-job.publisher.ts
|   |   |-- ai-result.consumer.ts
|   |   |-- ai-result.service.ts
|   |   `-- ai-contracts.ts
|   |
|   |-- sockets/
|   |   |-- socket.ts
|   |   |-- auth.socket.ts
|   |   `-- events.ts
|   |
|   |-- middleware/
|   |   |-- auth.middleware.ts
|   |   |-- project-access.middleware.ts
|   |   |-- validate.middleware.ts
|   |   |-- rate-limit.middleware.ts
|   |   `-- error.middleware.ts
|   |
|   |-- validators/
|   |   |-- auth.validator.ts
|   |   |-- project.validator.ts
|   |   |-- task.validator.ts
|   |   `-- meeting.validator.ts
|   |
|   |-- utils/
|   |   |-- ApiError.ts
|   |   |-- asyncHandler.ts
|   |   |-- dates.ts
|   |   |-- pagination.ts
|   |   `-- tokens.ts
|   |
|   `-- types/
|       |-- express.d.ts
|       `-- api.ts
|
|-- ai-service/
|   |-- graphs/
|   |   |-- meeting_graph.py
|   |   |-- command_graph.py
|   |   `-- state.py
|   |
|   |-- agents/
|   |   |-- extraction_agent.py
|   |   |-- duplicate_agent.py
|   |   `-- command_agent.py
|   |
|   |-- nodes/
|   |   |-- load_context.py
|   |   |-- transcription.py
|   |   |-- normalize_transcript.py
|   |   |-- extraction.py
|   |   |-- assignee_matching.py
|   |   |-- duplicate_detection.py
|   |   `-- review_preparation.py
|   |
|   |-- services/
|   |   |-- llm.py
|   |   |-- embeddings.py
|   |   |-- transcription.py
|   |   |-- vector_search.py
|   |   `-- redis_transport.py
|   |
|   |-- schemas/
|   |   |-- jobs.py
|   |   |-- meeting.py
|   |   |-- task.py
|   |   `-- agent_state.py
|   |
|   |-- prompts/
|   |   |-- extraction.py
|   |   |-- duplicate.py
|   |   `-- command.py
|   |
|   |-- providers/
|   |   |-- llm/
|   |   |-- embeddings/
|   |   `-- transcription/
|   |
|   |-- tests/
|   |   |-- unit/
|   |   `-- integration/
|   |
|   |-- config.py
|   |-- worker.py
|   |-- pyproject.toml
|   `-- README.md
|
|-- contracts/
|   |-- ai-job.schema.json
|   `-- ai-result.schema.json
|
|-- tests/
|   |-- unit/
|   |-- integration/
|   `-- fixtures/
|
|-- scripts/
|   |-- seed.ts
|   `-- create-vector-index.md
|
|-- docs/
|   |-- API.md
|   `-- AGENTS.md
|
|-- .env.example
|-- .gitignore
|-- package.json
|-- package-lock.json
|-- tsconfig.json
|-- eslint.config.js
|-- docker-compose.yml
`-- README.md
```

### Folder rules

**Routes** define URLs and middleware only.

**Controllers** translate HTTP requests into service calls.

**Services** contain application/business logic.

**Models** contain MongoDB schemas/indexes.

**AI transport** publishes authorized work and applies validated results; it contains no prompts or provider SDK calls.

**Python graphs** define meaningful LangGraph workflow transitions and shared state.

**Python nodes** implement graph steps. Do not wrap every ordinary function in an artificial agent class.

**Python agents/prompts** contain model-driven reasoning and prompt definitions.

**Python services/providers** isolate LLM, embedding, transcription, vector-search, and Redis integrations.

**Contracts** are language-neutral, versioned JSON Schemas used to keep Pydantic and Zod models aligned.

**Node jobs** define Node-owned scheduled work.

**Node workers** execute Node-owned queued work. `ai-service/worker.py` consumes cross-runtime AI jobs.

Do not put AI prompts or provider SDKs anywhere in the Node application.

Do not put MongoDB queries directly inside route files.

Do not create one giant `meetingController.ts` that contains the entire pipeline.

---

# 20. Environment Variables

```env
NODE_ENV=development
PORT=5000

MONGODB_URI=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

REDIS_URL=
AI_JOB_STREAM=relay:ai:jobs
AI_RESULT_STREAM=relay:ai:results
AI_DEAD_LETTER_STREAM=relay:ai:dead-letter
AI_JOB_SCHEMA_VERSION=1
AI_RESULT_SCHEMA_VERSION=1
AI_WORKER_CONSUMER_GROUP=relay-ai-workers

GROQ_API_KEY=
GROQ_MODEL=qwen/qwen3.8-27b

EMBEDDING_PROVIDER=
EMBEDDING_API_KEY=

TRANSCRIPTION_PROVIDER=
TRANSCRIPTION_API_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

FRONTEND_URL=

TELEGRAM_BOT_TOKEN=
```

Node and Python may load separate environment files in local development, but shared names and contracts must remain consistent. If Python receives a MongoDB URI for read-only context/vector search, use credentials restricted to the required collections and operations.

Use `.env.example` with secret values blank. Non-secret stream names and schema versions may have safe defaults.

Never commit real secrets.

---

# 21. Versioned Build Plan

The project should be implemented in versions rather than trying to build the entire product simultaneously.

---

## v0.1 — Backend Foundation

### Goal

Create a clean backend skeleton that can run locally and connect to MongoDB.

### Build

- Node.js + TypeScript project
- Express server
- MongoDB Atlas connection
- environment validation
- centralized error handling
- request logging
- `/health` endpoint
- base `/api` router
- folder structure from §19
- Swagger setup
- monorepo layout with `ai-service/` placeholder and shared AI contract directory

### Done when

```http
GET /health
```

returns successfully and MongoDB connection health is confirmed.

---

## v0.2 — Authentication & Projects

### Build

- User model
- Project model
- Membership model
- signup
- login
- refresh token
- logout
- auth middleware
- project CRUD
- member access checks
- seed script

### Demo

User can create an account, log in, create a project, and retrieve only projects they belong to.

---

## v0.3 — Kanban Backend

### Build

- Task model
- TaskActivity model
- task CRUD
- board filters
- project-specific owner/admin Kanban columns
- dynamic grouped board endpoint
- assignment
- priority
- due dates
- stable column movement
- activity logging
- dashboard aggregation

### Demo

Lovable frontend can run the complete Kanban board against real backend data.

No AI is needed yet.

---

## v0.4 — Transcript Meetings

### Build

- Meeting model
- TranscriptSegment model
- transcript meeting creation
- transcript parsing/storage
- meeting library endpoints
- meeting detail endpoint
- meeting status endpoint
- meeting → tasks endpoint

### Why transcript first

This lets Relay develop and test the actual AI feature without waiting for audio upload/transcription.

---

## v0.5 — Task Extraction Agent

### Build

- Python 3.12+ AI service
- LangGraph meeting graph
- Python LLM provider interface
- extraction prompt
- Pydantic structured output
- versioned Node/Python job and result contracts
- minimal Redis Streams job/result path
- independently runnable Python worker
- Node Zod validation at the result boundary
- TaskCandidate model
- transcript → candidate pipeline
- candidate review endpoints
- approve
- edit
- reject
- bulk approve/reject
- source traceability

### Demo

Paste meeting transcript → receive structured task candidates → approve one → task appears on board with meeting source.

Node remains responsible for candidate persistence and approval. Python returns review-ready structured proposals.

This is the **first real Relay AI demo**.

---

## v0.6 — Async Processing

### Build

- Redis
- BullMQ
- Node queue definitions for scheduled work
- production hardening of Redis Streams AI job/result transport
- LangGraph meeting pipeline orchestration
- idempotent Node result consumer
- retry policy
- dead-letter and failed-job handling
- Socket.IO processing events

### Demo

Meeting processing starts asynchronously and frontend receives live status updates.

The demo must also prove that the Node API and Python worker can start independently.

---

## v0.7 — Audio Meetings

### Build

- multipart upload
- Node storage provider
- audio file validation
- Python transcription provider
- transcript segmentation
- audio meeting pipeline
- retry without re-upload

### Demo

Upload MP3/WAV/M4A → transcription → extraction → review.

---

## v0.8 — Duplicate Detection & Cross-Meeting Memory

### Build

- Python embedding provider
- task/candidate embeddings
- MongoDB Atlas Vector Search index
- project-scoped read-only similarity search from Python
- DuplicateCandidate model
- optional Python LLM duplicate verification
- resolution endpoints
- cross-meeting update suggestions

### Demo

Meeting 1 creates a task. Meeting 2 mentions the same work with a changed deadline. Relay detects the existing task and asks whether to update it.

This is the **main agentic differentiator** of Relay.

---

## v0.9 — Notifications & Deadline Agent

### Build

- Notification model
- notification preferences
- deadline monitor
- upcoming deadline detection
- overdue detection
- deduplication
- realtime notification events

### Demo

Relay automatically produces notifications for upcoming and overdue work.

---

## v0.10 — Natural-Language Command Agent

### Build

- CommandLog model
- shared command intent contract
- Python Pydantic command schema
- LangGraph command graph
- project-context retrieval
- entity resolution
- Node-owned confirmation flow
- read-only query execution
- Node-owned mutation execution

### Demo

```text
"Move authentication to done"
```

Relay finds the matching task, shows the intended action, waits for confirmation, then performs it.

---

## v0.11 — Integrations

### Build

- Telegram integration
- connect/disconnect
- Telegram notifications
- integration settings

This version is optional for the initial portfolio demo.

---

## v1.0 — Portfolio Release

### Required before calling Relay v1

- auth works reliably
- project authorization tested
- manual Kanban works
- transcript ingestion works
- audio ingestion works
- extraction works
- review works
- source traceability works
- duplicate detection works
- cross-meeting update proposal works
- deadline monitoring works
- command agent works
- Node API and Python worker start independently
- AI job/result schemas are versioned and validated on both sides
- Python has no general write access to application collections
- common errors handled properly
- rate limits on expensive AI routes
- integration tests for critical flows
- Swagger/OpenAPI available
- README setup instructions complete

### Main v1 demo story

```text
1. Create/open project
2. Upload or paste first meeting
3. Relay extracts tasks
4. Human approves tasks
5. Tasks appear on Kanban board
6. Upload second meeting
7. Relay recognizes one task already exists
8. Relay proposes changed deadline/status information
9. Human updates existing task
10. Source history shows where each change came from
```

That flow should be prioritized over adding many minor features.

---

# 22. Testing Strategy

## Unit tests

Focus on:

- date resolution utilities
- authorization rules
- duplicate threshold mapping
- API validators
- command parsing helpers
- task activity generation

Python unit tests focus on:

- Pydantic job, graph-state, and result schemas
- transcript normalization
- extraction output validation
- assignee matching
- duplicate threshold mapping and LLM classification parsing
- command intent parsing
- LangGraph routing and failure paths

## Integration tests

Critical flows:

```text
signup -> login -> project creation
project -> task CRUD
transcript -> extraction -> candidate
candidate -> approval -> task
candidate -> duplicate -> resolution
task -> deadline -> notification
command -> confirmation -> mutation
```

AI providers should be mocked in automated tests.

Cross-runtime contract tests must run the same JSON fixtures through both the Node Zod schemas and Python Pydantic schemas. Integration tests must cover job redelivery and prove that applying the same `jobId` twice does not duplicate application records.

Do not make CI depend on paid external AI calls.

---

# 23. Security Requirements

- hash passwords with bcrypt
- validate all input
- sanitize uploaded filenames
- enforce file MIME/size rules
- restrict CORS to known frontend origins
- rate limit authentication and AI endpoints
- verify project membership on every project resource
- use signed/secured audio URLs where possible
- never expose raw provider errors to clients
- never expose AI keys
- give the Python worker read-only MongoDB credentials limited to the context and vector-search operations it requires
- do not allow AI job payloads to grant authorization; Node must authorize before publishing and revalidate before applying results
- authenticate Redis, use TLS in hosted environments, and restrict stream access to Relay services
- avoid logging passwords/tokens/full private meeting audio
- store only required transcript excerpts in AI logs

---

# 24. Observability

For each AI call record operational metadata such as:

```text
agent
provider
model
jobId/schemaVersion
graph/node where applicable
meetingId/projectId where applicable
input token estimate
output token estimate
latency
success/failure
retry count
```

Do not store secret API keys or authentication tokens.

Prompt/output logging should be configurable because meeting transcripts may contain private information.

Node and Python logs must share the same `jobId`/correlation ID so one meeting run can be traced across both runtimes.

---

# 25. Important Product Rules

### Rule 1 — Human approval before task creation

Meeting extraction must never silently populate the Kanban board.

### Rule 2 — Human approval before merging/updating duplicates

Semantic similarity is a suggestion, not authority.

### Rule 3 — Preserve traceability

Meeting-created tasks permanently retain their source meeting/segment reference.

### Rule 4 — Agents produce structured output

Agent responses used by backend logic must be schema-validated.

### Rule 5 — Provider independence

Application services call Relay interfaces, not Gemini/OpenAI/Claude SDKs directly.

### Rule 6 — Frontend stays replaceable

Lovable is the current frontend implementation, but the backend API must not depend on Lovable-specific runtime behavior.

### Rule 7 — Ship the core workflow before integrations

Do not delay the main meeting → extraction → review → board → cross-meeting update flow for Telegram or secondary features.

### Rule 8 — Node owns application state

Python returns structured AI results. Node authorizes, validates, persists, emits frontend events, and executes confirmed mutations.

### Rule 9 — AI implementation stays in Python

Do not add prompts, LangGraph orchestration, LLM/STT/embedding SDK calls, or duplicate-reasoning logic to Express controllers or TypeScript services. Shared language-neutral contracts are the exception.

### Rule 10 — Cross-runtime contracts are versioned

Node and Python must reject unsupported schema versions rather than guessing at payload compatibility.

---

# 26. Initial Development Priority

Build in this exact order unless a blocking technical issue forces a change:

```text
1. Backend skeleton
2. MongoDB + auth
3. Projects/memberships
4. Manual Kanban
5. Transcript meetings
6. Python AI service + extraction graph
7. Node/Python job contracts + human review
8. Async transport hardening
9. Audio transcription
10. Python embeddings + duplicate detection
11. Cross-meeting task update flow
12. Notifications/deadline monitoring
13. Python command graph + Node confirmation execution
14. Telegram
15. Hardening + tests
```

The first milestone worth showing publicly is **v0.5**.

The feature that makes Relay materially more interesting than a meeting-summary wrapper is **v0.8: cross-meeting duplicate/update intelligence**.

---

# 27. Migration Guardrails for Existing TypeScript AI Code

If AI-specific TypeScript code already exists when this architecture is implemented, migrate it incrementally:

1. Inventory every TypeScript file and dependency responsible for prompts, LLM calls, embeddings, transcription, extraction, duplicate reasoning, command interpretation, or orchestration.
2. Map each dependency on controllers, services, models, queues, and persistence before moving code.
3. Publish a short file-by-file migration plan identifying what remains in Node, what moves to Python, and the final folder structure.
4. Define and test the versioned job/result contract before replacing execution paths.
5. Implement and verify Python replacements node by node; do not translate TypeScript line by line.
6. Keep working TypeScript behavior until the corresponding Python path passes unit, contract, and end-to-end tests.
7. Switch Node to the Python job path behind configuration where practical.
8. Remove obsolete AI-specific TypeScript files and unused SDK dependencies only after verification.
9. Update `.env.example`, README/setup instructions, worker runbooks, and deployment configuration.
10. Verify the Node backend and Python worker start independently and that a transcript completes this flow:

```text
transcript
  -> Python extraction
  -> structured candidates
  -> duplicate check
  -> Node validation/persistence
  -> review-ready meeting
```

Do not redesign unrelated controllers, CRUD services, authentication, database models, frontend contracts, or Lovable UI during the migration.

---

# 28. Final Backend Definition

Relay's backend is not simply:

```text
meeting -> LLM -> tasks
```

The intended system is:

```text
Meeting
   |
   v
Transcript
   |
   v
Extraction Agent
   |
   v
Structured Candidate Tasks
   |
   v
Duplicate / Existing-Task Detection
   |
   v
Human Review
   |
   +------> Create new task
   |
   +------> Update existing task
   |
   +------> Reject / ignore
   |
   v
Persistent Kanban State
   |
   +------> Deadline Monitoring
   |
   +------> Notifications
   |
   +------> Natural-Language Commands
   |
   v
Future Meetings Feed Back Into Existing Work
```

That loop — **meetings continuously updating structured project state while humans remain in control** — is the core technical idea behind Relay.
