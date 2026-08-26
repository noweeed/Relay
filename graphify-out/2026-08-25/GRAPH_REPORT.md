# Graph Report - Relay  (2026-08-25)

## Corpus Check
- 81 files · ~25,272 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 568 nodes · 895 edges · 41 communities (23 shown, 18 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- properties
- properties
- app.ts
- devDependencies
- Meeting Processing Pipeline
- compilerOptions
- dependencies
- scripts
- error
- task.service.ts
- project.service.ts
- jobs.py
- Relay Backend and AI PRD
- parse_args
- Settings
- Error Flow
- Relay Backend
- kanban.service.ts
- Graphify Codebase Navigation Rules
- api.ts
- project.routes.ts
- agents/__init__.py
- graphs/__init__.py
- nodes/__init__.py
- prompts/__init__.py
- providers/__init__.py
- Deadline Notification Flow
- Natural-Language Command Flow
- schemas/__init__.py
- services/__init__.py
- Manual Task Flow
- relay-ai-service
- Product Decisions Still Required
- Relay Local Setup
- API.md
- frontend/README.md
- auth.service.ts
- check-ai.mjs

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 15 edges
2. `compilerOptions` - 15 edges
3. `scripts` - 11 edges
4. `createApp()` - 10 edges
5. `env` - 9 edges
6. `required` - 8 edges
7. `Membership` - 8 edges
8. `KanbanColumn` - 8 edges
9. `Project` - 8 edges
10. `User` - 8 edges

## Surprising Connections (you probably didn't know these)
- `v0.1 Backend Foundation Status` --semantically_similar_to--> `v0.1 Foundation`  [INFERRED] [semantically similar]
  PROGRESS.md → README.md
- `Audio Meeting Flow` --implements--> `Meeting Processing Pipeline`  [EXTRACTED]
  FLOW.md → Relay_PRD.md
- `Transcript Meeting Flow` --implements--> `Meeting Processing Pipeline`  [EXTRACTED]
  FLOW.md → Relay_PRD.md
- `test_failed_result_requires_error()` --uses--> `ResultEnvelope`  [INFERRED]
  backend/ai-service/tests/test_job_schemas.py → backend/ai-service/relay_ai/schemas/jobs.py
- `Milestone Roadmap` --conceptually_related_to--> `Relay Backend and AI PRD`  [EXTRACTED]
  PROGRESS.md → Relay_PRD.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Relay Core Meeting-to-Task Workflow** — relay_prd_meeting_processing_pipeline, relay_prd_task_candidate, relay_prd_human_approval, relay_prd_task, relay_prd_source_traceability [EXTRACTED 1.00]
- **Relay Cross-Runtime AI Architecture** — relay_prd_node_authoritative_application_layer, relay_prd_python_ai_worker, relay_prd_redis_streams, relay_prd_versioned_cross_runtime_contracts [EXTRACTED 1.00]
- **Human-Controlled Cross-Meeting Intelligence** — relay_prd_duplicate_detection_agent, relay_prd_cross_meeting_task_updates, relay_prd_human_approval [EXTRACTED 1.00]

## Communities (41 total, 18 thin omitted)

### Community 0 - "properties"
Cohesion: 0.05
Nodes (42): additionalProperties, minLength, type, format, type, $id, minLength, type (+34 more)

### Community 1 - "properties"
Cohesion: 0.04
Nodes (44): additionalProperties, allOf, format, type, minLength, type, $id, minLength (+36 more)

### Community 2 - "app.ts"
Cohesion: 0.11
Nodes (24): main(), seed(), createApp(), connectDatabase(), databaseStates, disconnectDatabase(), getDatabaseHealth(), env (+16 more)

### Community 3 - "devDependencies"
Cohesion: 0.06
Nodes (33): devDependencies, eslint, @eslint/js, mongodb-memory-server, supertest, tsx, @types/bcrypt, @types/cookie-parser (+25 more)

### Community 4 - "Meeting Processing Pipeline"
Cohesion: 0.10
Nodes (24): AI Job Lifecycle, Audio Meeting Flow, Candidate Review Flow, Duplicate and Cross-Meeting Update Flow, Runtime Architecture Flow, Transcript Meeting Flow, Live MongoDB Atlas Acceptance Check, v0.1 Backend Foundation Status (+16 more)

### Community 5 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noImplicitOverride, noUncheckedIndexedAccess (+14 more)

### Community 6 - "dependencies"
Cohesion: 0.07
Nodes (29): dependencies, bcrypt, cookie-parser, cors, dotenv, express, express-rate-limit, helmet (+21 more)

### Community 7 - "scripts"
Cohesion: 0.11
Nodes (18): description, engines, node, main, name, private, scripts, ai:check (+10 more)

### Community 8 - "error"
Cohesion: 0.12
Nodes (16): minLength, type, additionalProperties, properties, required, type, minLength, type (+8 more)

### Community 9 - "task.service.ts"
Cohesion: 0.07
Nodes (45): createTask(), deleteTask(), getTask(), getTaskContext(), getTaskId(), listTaskActivity(), listTasks(), updateTask() (+37 more)

### Community 10 - "project.service.ts"
Cohesion: 0.08
Nodes (36): LegacyProjectRecord, Membership, MembershipDocument, membershipSchema, PROJECT_ROLES, ProjectRole, KANBAN_COLUMN_CATEGORIES, KanbanColumn (+28 more)

### Community 11 - "jobs.py"
Cohesion: 0.23
Nodes (10): JobEnvelope, JobError, JobType, Require a payload for success and a structured error for failure., ResultEnvelope, test_failed_result_requires_error(), test_job_envelope_accepts_v1_contract(), BaseModel (+2 more)

### Community 12 - "Relay Backend and AI PRD"
Cohesion: 0.60
Nodes (5): Relay System Flows, Milestone Roadmap, Relay Development Progress, Relay Project README, Relay Backend and AI PRD

### Community 13 - "parse_args"
Cohesion: 0.29
Nodes (6): Relay's Python AI worker package., main(), parse_args(), Parse worker lifecycle flags from the command line., Validate worker startup now and host the Redis loop in later milestones., Namespace

### Community 14 - "Settings"
Cohesion: 0.40
Nodes (5): load_settings(), Validate environment variables and return worker configuration., Environment-backed configuration for the AI worker., Settings, BaseSettings

### Community 16 - "Relay Backend"
Cohesion: 0.22
Nodes (7): Relay AI service, How the authentication code is organized, Important generated directories, Node setup, Python AI worker, Relay Backend, Structure

### Community 17 - "kanban.service.ts"
Cohesion: 0.20
Nodes (21): createColumn(), deleteColumn(), getColumnId(), getKanbanContext(), listColumns(), reorderColumns(), updateColumn(), assertUniqueName() (+13 more)

### Community 20 - "project.routes.ts"
Cohesion: 0.07
Nodes (33): deleteProject(), getProject(), getProjectContext(), inviteProjectMember(), listProjectMembers(), removeProjectMember(), updateProject(), RequestSchemas (+25 more)

### Community 39 - "auth.service.ts"
Cohesion: 0.09
Nodes (35): getRefreshCookieOptions(), getSessionMetadata(), login(), logout(), me(), refresh(), sendAuthenticationResult(), signup() (+27 more)

### Community 40 - "check-ai.mjs"
Cohesion: 0.50
Nodes (4): aiServiceDirectory, backendDirectory, main(), resolvePythonInterpreter()

## Knowledge Gaps
- **203 isolated node(s):** `relay-ai-service`, `$schema`, `$id`, `title`, `type` (+198 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApiError` connect `auth.service.ts` to `app.ts`, `task.service.ts`, `project.service.ts`, `kanban.service.ts`, `project.routes.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `relay-ai-service`, `$schema`, `$id` to the rest of the system?**
  _203 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `properties` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `properties` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11336032388663968 - nodes in this community are weakly interconnected._