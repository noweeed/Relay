# Graph Report - backend  (2026-08-26)

## Corpus Check
- 87 files · ~20,339 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 596 nodes · 1030 edges · 33 communities (23 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- project.service.ts
- task.service.ts
- meeting.service.ts
- properties
- properties
- app.ts
- auth.service.ts
- devDependencies
- project.routes.ts
- dependencies
- auth.controller.ts
- compilerOptions
- kanban.service.ts
- scripts
- error
- jobs.py
- Relay Backend
- parse_args
- Settings
- check-ai.mjs
- api.ts
- agents/__init__.py
- graphs/__init__.py
- nodes/__init__.py
- prompts/__init__.py
- providers/__init__.py
- schemas/__init__.py
- services/__init__.py
- API.md
- relay-ai-service

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 19 edges
2. `compilerOptions` - 15 edges
3. `scripts` - 11 edges
4. `createApp()` - 11 edges
5. `env` - 10 edges
6. `Membership` - 10 edges
7. `Project` - 10 edges
8. `KanbanColumn` - 9 edges
9. `User` - 9 edges
10. `required` - 8 edges

## Surprising Connections (you probably didn't know these)
- `test_failed_result_requires_error()` --uses--> `ResultEnvelope`  [INFERRED]
  ai-service/tests/test_job_schemas.py → ai-service/relay_ai/schemas/jobs.py
- `main()` --calls--> `connectDatabase()`  [EXTRACTED]
  scripts/migrate-kanban-columns.ts → src/config/database.ts
- `main()` --calls--> `disconnectDatabase()`  [EXTRACTED]
  scripts/migrate-kanban-columns.ts → src/config/database.ts
- `main()` --calls--> `migrateKanbanColumns()`  [EXTRACTED]
  scripts/migrate-kanban-columns.ts → src/migrations/kanban-columns.migration.ts
- `seed()` --calls--> `connectDatabase()`  [EXTRACTED]
  scripts/seed.ts → src/config/database.ts

## Import Cycles
- None detected.

## Communities (33 total, 10 thin omitted)

### Community 0 - "project.service.ts"
Cohesion: 0.07
Nodes (44): LegacyProjectRecord, Membership, MembershipDocument, membershipSchema, PROJECT_ROLES, ProjectRole, KANBAN_COLUMN_CATEGORIES, KanbanColumn (+36 more)

### Community 1 - "task.service.ts"
Cohesion: 0.07
Nodes (51): createTask(), deleteTask(), getTask(), getTaskContext(), getTaskId(), listTaskActivity(), listTasks(), updateTask() (+43 more)

### Community 2 - "meeting.service.ts"
Cohesion: 0.08
Nodes (39): createMeeting(), getMeeting(), getMeetingContext(), getMeetingId(), getMeetingTasks(), getMeetingTranscript(), listMeetings(), requestReprocess() (+31 more)

### Community 3 - "properties"
Cohesion: 0.04
Nodes (44): additionalProperties, allOf, format, type, minLength, type, $id, minLength (+36 more)

### Community 4 - "properties"
Cohesion: 0.05
Nodes (42): additionalProperties, minLength, type, format, type, $id, minLength, type (+34 more)

### Community 5 - "app.ts"
Cohesion: 0.11
Nodes (25): main(), seed(), createApp(), connectDatabase(), databaseStates, disconnectDatabase(), getDatabaseHealth(), env (+17 more)

### Community 6 - "auth.service.ts"
Cohesion: 0.12
Nodes (23): authenticate(), requireProjectMembership(), requireProjectRole(), UserDocument, AuthenticationResult, createSession(), getCurrentUser(), login() (+15 more)

### Community 7 - "devDependencies"
Cohesion: 0.06
Nodes (33): eslint, @eslint/js, mongodb-memory-server, devDependencies, eslint, @eslint/js, mongodb-memory-server, supertest (+25 more)

### Community 8 - "project.routes.ts"
Cohesion: 0.10
Nodes (26): deleteProject(), getProject(), getProjectContext(), inviteProjectMember(), listProjectMembers(), removeProjectMember(), updateProject(), columnColor (+18 more)

### Community 9 - "dependencies"
Cohesion: 0.06
Nodes (31): bcrypt, cookie-parser, cors, dotenv, express, express-rate-limit, helmet, jsonwebtoken (+23 more)

### Community 10 - "auth.controller.ts"
Cohesion: 0.12
Nodes (20): getRefreshCookieOptions(), getSessionMetadata(), login(), logout(), me(), refresh(), sendAuthenticationResult(), signup() (+12 more)

### Community 11 - "compilerOptions"
Cohesion: 0.09
Nodes (22): dist, node_modules, src/**/*.d.ts, src/**/*.ts, tests, compilerOptions, declaration, esModuleInterop (+14 more)

### Community 12 - "kanban.service.ts"
Cohesion: 0.20
Nodes (21): createColumn(), deleteColumn(), getColumnId(), getKanbanContext(), listColumns(), reorderColumns(), updateColumn(), assertUniqueName() (+13 more)

### Community 13 - "scripts"
Cohesion: 0.11
Nodes (18): description, engines, node, main, name, private, scripts, ai:check (+10 more)

### Community 14 - "error"
Cohesion: 0.12
Nodes (16): minLength, type, additionalProperties, properties, required, type, minLength, type (+8 more)

### Community 15 - "jobs.py"
Cohesion: 0.23
Nodes (10): JobEnvelope, JobError, JobType, Require a payload for success and a structured error for failure., ResultEnvelope, test_failed_result_requires_error(), test_job_envelope_accepts_v1_contract(), BaseModel (+2 more)

### Community 16 - "Relay Backend"
Cohesion: 0.22
Nodes (7): Relay AI service, How the authentication code is organized, Important generated directories, Node setup, Python AI worker, Relay Backend, Structure

### Community 17 - "parse_args"
Cohesion: 0.29
Nodes (6): Relay's Python AI worker package., main(), parse_args(), Parse worker lifecycle flags from the command line., Validate worker startup now and host the Redis loop in later milestones., Namespace

### Community 18 - "Settings"
Cohesion: 0.40
Nodes (5): load_settings(), Validate environment variables and return worker configuration., Environment-backed configuration for the AI worker., Settings, BaseSettings

### Community 19 - "check-ai.mjs"
Cohesion: 0.50
Nodes (4): aiServiceDirectory, backendDirectory, main(), resolvePythonInterpreter()

## Knowledge Gaps
- **199 isolated node(s):** `relay-ai-service`, `$schema`, `$id`, `title`, `type` (+194 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApiError` connect `auth.service.ts` to `project.service.ts`, `task.service.ts`, `meeting.service.ts`, `app.ts`, `project.routes.ts`, `auth.controller.ts`, `kanban.service.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `relay-ai-service`, `$schema`, `$id` to the rest of the system?**
  _199 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `project.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06557377049180328 - nodes in this community are weakly interconnected._
- **Should `task.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07012987012987013 - nodes in this community are weakly interconnected._
- **Should `meeting.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07922705314009662 - nodes in this community are weakly interconnected._