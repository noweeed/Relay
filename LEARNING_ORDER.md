# Relay Learning Order

This is the order I recommend reading the project. Do not try to memorize everything. For each
feature, follow one request from the route to the controller, then the service, model, and test.

```text
HTTP request
  -> route
  -> validation and authorization middleware
  -> controller
  -> service
  -> Mongoose model / MongoDB
  -> JSON response
```

## 1. Understand the product first

1. `README.md` — repository overview and the main folders.
2. `Relay_PRD.md` — the complete product requirements and future milestones.
3. `PROGRESS.md` — what is complete now and what comes next.
4. `FLOW.md` — visual flows for authentication, tasks, meetings, and AI processing.
5. `backend/README.md` — how the backend is organized and run.
6. `backend/docs/API.md` — the implemented HTTP endpoints and example requests.
7. `frontend/README.md` — frontend setup and the current real-versus-mocked integration boundary.

## 2. Learn how the backend starts

8. `backend/package.json` — scripts and Node dependencies. Learn `dev`, `typecheck`, `lint`,
   `test`, and `build`; do not study `package-lock.json` line by line.
9. `backend/tsconfig.json` — TypeScript compiler rules.
10. `backend/eslint.config.mjs` — code-quality rules.
11. `backend/src/config/env.ts` — validates environment variables before startup. Never commit the
    real `.env` file.
12. `backend/src/config/logger.ts` — creates structured application logs.
13. `backend/src/config/database.ts` — connects Mongoose to MongoDB and configures DNS.
14. `backend/src/app.ts` — builds the Express application and installs global middleware/routes.
15. `backend/src/server.ts` — connects infrastructure, creates the HTTP server, and starts Socket.IO.
16. `backend/src/routes/index.ts` — mounts the API's top-level route groups.

After this section, explain the difference between `app.ts` and `server.ts`: tests can create the
Express app without opening a real network port.

## 3. Learn the shared request tools

17. `backend/src/types/api.ts` — shared API response types.
18. `backend/src/types/express.d.ts` — adds authenticated user/project data to Express requests.
19. `backend/src/utils/ApiError.ts` — represents safe HTTP errors.
20. `backend/src/utils/asyncHandler.ts` — forwards rejected async controllers to error middleware.
21. `backend/src/middleware/validate.middleware.ts` — uses Zod schemas to reject invalid input.
22. `backend/src/middleware/error.middleware.ts` — converts errors into consistent JSON responses.
23. `backend/src/middleware/rate-limit.middleware.ts` — limits repeated authentication requests.
24. `backend/src/routes/health.routes.ts` → `controllers/health.controller.ts` →
    `services/health.service.ts` — the smallest complete route/controller/service example.

## 4. Learn authentication and security

Read this feature vertically in this order:

25. `backend/src/models/User.model.ts` — user identity and password-hash storage.
26. `backend/src/models/RefreshSession.model.ts` — revocable refresh-token sessions.
27. `backend/src/validators/auth.validator.ts` — signup/login input rules.
28. `backend/src/utils/tokens.ts` — signs/verifies JWTs and hashes stored refresh tokens.
29. `backend/src/services/auth.service.ts` — signup, login, refresh, logout, and current-user logic.
30. `backend/src/controllers/auth.controller.ts` — translates HTTP requests/cookies to service calls.
31. `backend/src/middleware/auth.middleware.ts` — verifies access JWTs on protected routes.
32. `backend/src/routes/auth.routes.ts` — public and protected authentication endpoints.
33. `backend/tests/unit/tokens.test.ts` — isolated JWT/token behavior.
34. `backend/tests/integration/auth-boundary.test.ts` — invalid credentials and security boundaries.

Key lesson: the access JWT proves who the caller is; the refresh cookie carries a longer-lived,
revocable session token. The cookie name is not a secret.

## 5. Learn projects, memberships, and authorization

35. `backend/src/models/Project.model.ts` — projects plus embedded custom Kanban columns.
36. `backend/src/models/Membership.model.ts` — connects a user to a project with a role.
37. `backend/src/validators/project.validator.ts` — project/member request rules.
38. `backend/src/middleware/project-access.middleware.ts` — checks membership and owner/admin roles.
39. `backend/src/services/project.service.ts` — project CRUD, invitations, removal, and cascade deletion.
40. `backend/src/controllers/project.controller.ts` — project HTTP adapter functions.
41. `backend/src/routes/project.routes.ts` — the main project-scoped router. First study only the
    project/member routes; return later for Kanban, task, overview, and meeting routes.
42. `backend/tests/unit/project-role.middleware.test.ts` — role-checking behavior.
43. `backend/tests/integration/auth-project-flow.test.ts` — complete auth/project/member journey.

Key lesson: every project query is scoped using the authorized `projectId`; knowing another
project's ID must never grant access.

## 6. Learn custom Kanban columns

44. `backend/src/validators/kanban.validator.ts` — column name, color, category, and ordering rules.
45. `backend/src/services/kanban.service.ts` — add, edit, reorder, and safely delete columns.
46. `backend/src/controllers/kanban.controller.ts` — Kanban HTTP adapters.
47. Revisit the Kanban routes in `backend/src/routes/project.routes.ts`.
48. `backend/tests/integration/kanban-columns.test.ts` — permissions and board invariants.
49. `backend/src/migrations/kanban-columns.migration.ts` — converts legacy task statuses to columns.
50. `backend/scripts/migrate-kanban-columns.ts` — runnable migration command.
51. `backend/tests/integration/kanban-migration.test.ts` — proves the migration is idempotent.

Key lesson: tasks store a stable `columnId`, so renaming or reordering a column does not rewrite
every task.

## 7. Learn tasks, activity, overview, and live events

52. `backend/src/models/Task.model.ts` — task fields, custom column assignment, and source tracing.
53. `backend/src/models/TaskActivity.model.ts` — task audit history.
54. `backend/src/validators/task.validator.ts` — create/update/list input validation.
55. `backend/src/sockets/io.ts` — initializes and exposes the Socket.IO server.
56. `backend/src/sockets/taskEvents.ts` — emits project-scoped task events.
57. `backend/src/services/task.service.ts` — task CRUD, column movement, activity, and event emission.
58. `backend/src/controllers/task.controller.ts` — task HTTP adapters.
59. Revisit the task routes in `backend/src/routes/project.routes.ts`.
60. `backend/src/services/overview.service.ts` — calculates dashboard totals from column categories.
61. `backend/src/controllers/overview.controller.ts` — overview HTTP adapter.
62. Revisit the overview route in `backend/src/routes/project.routes.ts`.
63. `backend/tests/integration/task-flow.test.ts` — complete board/task behavior.

## 8. Learn transcript meetings (v0.4)

64. `backend/src/models/Meeting.model.ts` — meeting metadata and processing state.
65. `backend/src/models/TranscriptSegment.model.ts` — ordered parsed transcript content.
66. `backend/src/utils/transcript-parser.ts` — recognizes speaker formats and merges consecutive lines.
67. `backend/tests/unit/transcript-parser.test.ts` — easiest way to understand parser edge cases.
68. `backend/src/validators/meeting.validator.ts` — meeting input, status, and ID rules.
69. `backend/src/services/meeting.service.ts` — atomically creates meetings/segments and serves them.
70. `backend/src/controllers/meeting.controller.ts` — meeting HTTP adapters.
71. Revisit the seven meeting routes in `backend/src/routes/project.routes.ts`.
72. `backend/tests/integration/meeting-flow.test.ts` — the full v0.4 acceptance flow and authorization.
73. `backend/src/config/swagger.ts` — OpenAPI definitions; read the meeting paths first, then the rest.

Key lesson: parsing happens before the MongoDB transaction, then the meeting and all segments are
written atomically so a partial transcript is never stored.

## 9. Learn the v0.5 AI foundation

First understand the language-independent contract, then each language's validation:

74. `backend/contracts/ai-job.schema.json` — shared AI job envelope.
75. `backend/contracts/ai-result.schema.json` — shared success/failure result envelope.
76. `backend/src/contracts/ai.contract.ts` — Node/Zod validation at the AI boundary.
77. `backend/tests/unit/ai-contract.test.ts` — valid job and invalid result examples.
78. `backend/src/models/TaskCandidate.model.ts` — AI suggestions waiting for human approval.
79. `backend/ai-service/pyproject.toml` — Python dependencies and development-tool configuration.
80. `backend/ai-service/relay_ai/__init__.py` — Python package metadata.
81. `backend/ai-service/relay_ai/config.py` — typed Python worker configuration.
82. `backend/ai-service/relay_ai/schemas/jobs.py` — matching Pydantic job/result validation.
83. `backend/ai-service/tests/test_job_schemas.py` — Python contract tests.
84. `backend/ai-service/relay_ai/worker.py` — independently runnable worker entry point.
85. `backend/scripts/check-ai.mjs` — Node command that verifies Python worker startup.
86. `backend/ai-service/README.md` — Python setup and commands.

The following package markers are intentionally empty foundations. Read them only to understand
where upcoming v0.5 code belongs:

87. `backend/ai-service/relay_ai/providers/__init__.py` — future LLM provider adapters.
88. `backend/ai-service/relay_ai/prompts/__init__.py` — future versioned extraction prompts.
89. `backend/ai-service/relay_ai/nodes/__init__.py` — future LangGraph node functions.
90. `backend/ai-service/relay_ai/graphs/__init__.py` — future meeting graph assembly.
91. `backend/ai-service/relay_ai/agents/__init__.py` — future higher-level agent behavior.
92. `backend/ai-service/relay_ai/services/__init__.py` — future worker-side services.
93. `backend/ai-service/relay_ai/schemas/__init__.py` — schema package exports.

## 10. Learn testing and local data last

94. `backend/vitest.config.mjs` — Vitest configuration.
95. `backend/tests/setup.ts` — safe test environment defaults.
96. `backend/tests/integration/foundation.test.ts` — basic app/database foundation checks.
97. `backend/scripts/seed.ts` — creates development sample data.
98. `backend/package-lock.json` — generated exact dependency versions; do not manually study/edit it.

## How to study each function

For every exported function, answer these five questions in your own notes:

1. What input does it accept?
2. Who calls it?
3. What data can it read or change?
4. What error can it throw?
5. Which test proves it works?

Run these commands after experimenting:

```powershell
cd D:\Relay\backend
npm run typecheck
npm run lint
npm test
```

Start by tracing `POST /api/auth/signup`. Then trace `POST /api/projects`, task creation, meeting
creation, and finally the AI contract. Those five requests cover nearly every architectural pattern
currently implemented in Relay.
