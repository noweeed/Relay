# Graph Report - Relay  (2026-08-26)

## Corpus Check
- 96 files · ~30,303 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 773 nodes · 1211 edges · 66 communities (43 shown, 23 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- properties
- properties
- app.ts
- devDependencies
- v0.1 Foundation
- compilerOptions
- dependencies
- scripts
- properties
- task.service.ts
- project.service.ts
- jobs.py
- Relay System Flows
- parse_args
- Settings
- 21. Versioned Build Plan
- ai-service/README.md
- 10. Python AI System
- AGENTS.md
- api.ts
- project.routes.ts
- agents/__init__.py
- graphs/__init__.py
- nodes/__init__.py
- prompts/__init__.py
- providers/__init__.py
- Relay_PRD.md
- 5. Core Domain Model
- schemas/__init__.py
- services/__init__.py
- 25. Important Product Rules
- relay-ai-service
- ai.contract.ts
- Relay Local Setup
- API.md
- package.json
- auth.service.ts
- check-ai.mjs
- ai-result.schema.json
- meeting.service.ts
- error
- required
- enum
- 12. Duplicate Detection Agent
- Project roles
- status
- 4. High-Level Architecture
- 7. REST API
- 8. Meeting APIs
- completedAt
- projectId
- resourceId
- 22. Testing Strategy
- 3. Technology Stack
- bcrypt
- cors
- dotenv
- helmet
- jsonwebtoken
- openapi-types
- pino
- pino-http
- zod

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 19 edges
2. `compilerOptions` - 15 edges
3. `21. Versioned Build Plan` - 13 edges
4. `Relay System Flows` - 12 edges
5. `Milestone roadmap` - 12 edges
6. `5. Core Domain Model` - 12 edges
7. `scripts` - 11 edges
8. `createApp()` - 11 edges
9. `25. Important Product Rules` - 11 edges
10. `env` - 10 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `migrateKanbanColumns()`  [EXTRACTED]
  scripts/migrate-kanban-columns.ts → src/migrations/kanban-columns.migration.ts
- `seed()` --calls--> `connectDatabase()`  [EXTRACTED]
  scripts/seed.ts → src/config/database.ts
- `test_failed_result_requires_error()` --uses--> `ResultEnvelope`  [INFERRED]
  ai-service/tests/test_job_schemas.py → ai-service/relay_ai/schemas/jobs.py
- `main()` --calls--> `connectDatabase()`  [EXTRACTED]
  scripts/migrate-kanban-columns.ts → src/config/database.ts
- `main()` --calls--> `disconnectDatabase()`  [EXTRACTED]
  scripts/migrate-kanban-columns.ts → src/config/database.ts

## Import Cycles
- None detected.

## Communities (66 total, 23 thin omitted)

### Community 0 - "properties"
Cohesion: 0.05
Nodes (42): additionalProperties, minLength, type, format, type, $id, minLength, type (+34 more)

### Community 1 - "properties"
Cohesion: 0.18
Nodes (11): minLength, type, minLength, type, type, properties, correlationId, jobId (+3 more)

### Community 2 - "app.ts"
Cohesion: 0.15
Nodes (19): main(), createApp(), connectDatabase(), databaseStates, disconnectDatabase(), getDatabaseHealth(), env, environmentSchema (+11 more)

### Community 3 - "devDependencies"
Cohesion: 0.06
Nodes (33): devDependencies, eslint, @eslint/js, mongodb-memory-server, supertest, tsx, @types/bcrypt, @types/cookie-parser (+25 more)

### Community 5 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noImplicitOverride, noUncheckedIndexedAccess (+14 more)

### Community 6 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, cookie-parser, express, express-rate-limit, mongoose, socket.io, swagger-ui-express, cookie-parser (+5 more)

### Community 7 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, ai:check, build, dev, lint, migrate:kanban-columns, seed, start (+3 more)

### Community 8 - "properties"
Cohesion: 0.22
Nodes (9): minLength, type, properties, minLength, type, code, message, retryable (+1 more)

### Community 9 - "task.service.ts"
Cohesion: 0.06
Nodes (56): createTask(), deleteTask(), getTask(), getTaskContext(), getTaskId(), listTaskActivity(), listTasks(), updateTask() (+48 more)

### Community 10 - "project.service.ts"
Cohesion: 0.07
Nodes (42): seed(), firstColumnId(), KanbanMigrationResult, LegacyProjectRecord, migrateKanbanColumns(), migrateProject(), Membership, MembershipDocument (+34 more)

### Community 11 - "jobs.py"
Cohesion: 0.23
Nodes (10): JobEnvelope, JobError, JobType, Require a payload for success and a structured error for failure., ResultEnvelope, test_failed_result_requires_error(), test_job_envelope_accepts_v1_contract(), BaseModel (+2 more)

### Community 12 - "Relay System Flows"
Cohesion: 0.05
Nodes (36): 10. Error flow, 1. Runtime architecture, 2. Manual task flow, 3. Transcript meeting flow, 4. Audio meeting flow, 5. Candidate review flow, 6. Duplicate and cross-meeting update flow, 7. Natural-language command flow (+28 more)

### Community 13 - "parse_args"
Cohesion: 0.29
Nodes (6): Relay's Python AI worker package., main(), parse_args(), Parse worker lifecycle flags from the command line., Validate worker startup now and host the Redis loop in later milestones., Namespace

### Community 14 - "Settings"
Cohesion: 0.40
Nodes (5): load_settings(), Validate environment variables and return worker configuration., Environment-backed configuration for the AI worker., Settings, BaseSettings

### Community 15 - "21. Versioned Build Plan"
Cohesion: 0.05
Nodes (37): 21. Versioned Build Plan, Build, Build, Build, Build, Build, Build, Build (+29 more)

### Community 17 - "10. Python AI System"
Cohesion: 0.17
Nodes (12): 10.1 Meeting graph, 10.2 Speaker segmentation, 10.3 Task extraction agent, 10.4 Duplicate detection agent, 10.5 Command graph, 10. Python AI System, Input, Input (+4 more)

### Community 20 - "project.routes.ts"
Cohesion: 0.05
Nodes (57): createColumn(), deleteColumn(), getColumnId(), getKanbanContext(), listColumns(), reorderColumns(), updateColumn(), deleteProject() (+49 more)

### Community 26 - "Relay_PRD.md"
Cohesion: 0.09
Nodes (21): 11. Candidate Review, 13. Cross-Meeting Task Updates, 14. Natural-Language Command Agent, 15. Background Jobs and Cross-Runtime Transport, 16. Realtime Events, 17. Error Contract, 18. API Response Convention, 19. Backend Folder Structure (+13 more)

### Community 27 - "5. Core Domain Model"
Cohesion: 0.17
Nodes (12): 5.10 Notification, 5.11 Command Log, 5.1 User, 5.2 Project, 5.3 Membership, 5.4 Meeting, 5.5 Transcript Segment, 5.6 Task Candidate (+4 more)

### Community 30 - "25. Important Product Rules"
Cohesion: 0.18
Nodes (11): 25. Important Product Rules, Rule 10 — Cross-runtime contracts are versioned, Rule 1 — Human approval before task creation, Rule 2 — Human approval before merging/updating duplicates, Rule 3 — Preserve traceability, Rule 4 — Agents produce structured output, Rule 5 — Provider independence, Rule 6 — Frontend stays replaceable (+3 more)

### Community 32 - "ai.contract.ts"
Cohesion: 0.28
Nodes (7): aiErrorSchema, AiJobEnvelope, aiJobEnvelopeSchema, aiJobTypeSchema, aiResultBaseSchema, AiResultEnvelope, aiResultEnvelopeSchema

### Community 35 - "package.json"
Cohesion: 0.25
Nodes (7): description, engines, node, main, name, private, version

### Community 39 - "auth.service.ts"
Cohesion: 0.08
Nodes (40): getRefreshCookieOptions(), getSessionMetadata(), login(), logout(), me(), refresh(), sendAuthenticationResult(), signup() (+32 more)

### Community 40 - "check-ai.mjs"
Cohesion: 0.50
Nodes (4): aiServiceDirectory, backendDirectory, main(), resolvePythonInterpreter()

### Community 41 - "ai-result.schema.json"
Cohesion: 0.29
Nodes (6): additionalProperties, allOf, $id, $schema, title, type

### Community 42 - "meeting.service.ts"
Cohesion: 0.08
Nodes (40): createMeeting(), getMeeting(), getMeetingContext(), getMeetingId(), getMeetingTasks(), getMeetingTranscript(), listMeetings(), requestReprocess() (+32 more)

### Community 43 - "error"
Cohesion: 0.29
Nodes (7): additionalProperties, required, type, error, code, message, retryable

### Community 44 - "required"
Cohesion: 0.29
Nodes (7): jobId, jobType, projectId, schemaVersion, required, completedAt, status

### Community 45 - "enum"
Cohesion: 0.33
Nodes (6): enum, type, command.interpret, meeting.process, meeting.reprocess, jobType

### Community 46 - "12. Duplicate Detection Agent"
Cohesion: 0.33
Nodes (6): 12. Duplicate Detection Agent, Step 1 — Embedding, Step 2 — Atlas Vector Search, Step 3 — Candidate threshold, Step 4 — Optional LLM verification, Step 5 — Human decision

### Community 47 - "Project roles"
Cohesion: 0.33
Nodes (6): 6. Authentication & Authorization, Admin, Authentication, Member, Owner, Project roles

### Community 48 - "status"
Cohesion: 0.40
Nodes (5): status, enum, type, failed, succeeded

### Community 49 - "4. High-Level Architecture"
Cohesion: 0.40
Nodes (5): 4. High-Level Architecture, Backend responsibility, Data ownership and mutation rule, Frontend responsibility, Python AI worker responsibility

### Community 50 - "7. REST API"
Cohesion: 0.50
Nodes (4): 7.1 Projects, 7.2 Dashboard, 7.3 Tasks / Kanban, 7. REST API

### Community 51 - "8. Meeting APIs"
Cohesion: 0.50
Nodes (4): 8. Meeting APIs, Audio path, Meeting access, Transcript path

### Community 52 - "completedAt"
Cohesion: 0.67
Nodes (3): format, type, completedAt

### Community 53 - "projectId"
Cohesion: 0.67
Nodes (3): minLength, type, projectId

### Community 54 - "resourceId"
Cohesion: 0.67
Nodes (3): resourceId, minLength, type

### Community 55 - "22. Testing Strategy"
Cohesion: 0.67
Nodes (3): 22. Testing Strategy, Integration tests, Unit tests

### Community 56 - "3. Technology Stack"
Cohesion: 0.67
Nodes (3): 3. Technology Stack, Runtime boundary, Why MongoDB Atlas

## Knowledge Gaps
- **331 isolated node(s):** `relay-ai-service`, `$schema`, `$id`, `title`, `type` (+326 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApiError` connect `project.routes.ts` to `app.ts`, `auth.service.ts`, `task.service.ts`, `project.service.ts`, `meeting.service.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `21. Versioned Build Plan` connect `21. Versioned Build Plan` to `Relay_PRD.md`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `relay-ai-service`, `$schema`, `$id` to the rest of the system?**
  _331 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `properties` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14583333333333334 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._