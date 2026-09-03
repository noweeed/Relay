# Relay Learning Order

Read only these production files, in this order.

| # | File | Job | Next |
|---:|---|---|---|
| 1 | `Relay_PRD.md` | Product rules and architecture | `FLOW.md` |
| 2 | `FLOW.md` | End-to-end system flows | `PROGRESS.md` |
| 3 | `PROGRESS.md` | Completed and upcoming work | `backend/src/config/env.ts` |
| 4 | `backend/src/config/env.ts` | Validates Node configuration | `database.ts` |
| 5 | `backend/src/config/database.ts` | Connects MongoDB | `redis.ts` |
| 6 | `backend/src/config/redis.ts` | Connects Redis | `app.ts` |
| 7 | `backend/src/app.ts` | Builds the Express application | `server.ts` |
| 8 | `backend/src/server.ts` | Starts and stops infrastructure | `models/User.model.ts` |
| 9 | `backend/src/models/User.model.ts` | Stores users and account settings | `RefreshSession.model.ts` |
| 10 | `backend/src/models/RefreshSession.model.ts` | Stores revocable refresh sessions | `Project.model.ts` |
| 11 | `backend/src/models/Project.model.ts` | Stores projects and Kanban columns | `Membership.model.ts` |
| 12 | `backend/src/models/Membership.model.ts` | Connects users to projects and roles | `Meeting.model.ts` |
| 13 | `backend/src/models/Meeting.model.ts` | Stores meeting metadata and state | `TranscriptSegment.model.ts` |
| 14 | `backend/src/models/TranscriptSegment.model.ts` | Stores ordered transcript evidence | `TaskCandidate.model.ts` |
| 15 | `backend/src/models/TaskCandidate.model.ts` | Stores AI proposals for review | `Task.model.ts` |
| 16 | `backend/src/models/Task.model.ts` | Stores approved/manual tasks | `TaskActivity.model.ts` |
| 17 | `backend/src/models/TaskActivity.model.ts` | Stores task audit history | `auth.routes.ts` |
| 18 | `backend/src/routes/auth.routes.ts` | Defines authentication URLs | `auth.validator.ts` |
| 19 | `backend/src/validators/auth.validator.ts` | Validates authentication input | `auth.controller.ts` |
| 20 | `backend/src/controllers/auth.controller.ts` | Handles auth HTTP details | `auth.service.ts` |
| 21 | `backend/src/services/auth.service.ts` | Implements login and token rotation | `project.routes.ts` |
| 22 | `backend/src/routes/project.routes.ts` | Defines project-scoped endpoints | `project-access.middleware.ts` |
| 23 | `backend/src/middleware/project-access.middleware.ts` | Enforces membership and permissions | `project.service.ts` |
| 24 | `backend/src/services/project.service.ts` | Manages projects, members, and ownership | `kanban.service.ts` |
| 25 | `backend/src/services/kanban.service.ts` | Manages custom board columns | `task.service.ts` |
| 26 | `backend/src/services/task.service.ts` | Manages tasks and activity | `meeting.service.ts` |
| 27 | `backend/src/services/meeting.service.ts` | Stores and serves meetings | `meeting-ai.service.ts` |
| 28 | `backend/src/services/meeting-ai.service.ts` | Builds and queues meeting AI jobs | `transcript-parser.ts` |
| 29 | `backend/src/utils/transcript-parser.ts` | Parses pasted transcript lines | `ai.contract.ts` |
| 30 | `backend/src/contracts/ai.contract.ts` | Validates Node/Python envelopes and results | `ai-transport.service.ts` |
| 31 | `backend/src/services/ai-transport.service.ts` | Publishes jobs and reads AI results | `ai-result-persistence.service.ts` |
| 32 | `backend/src/services/ai-result-persistence.service.ts` | Saves validated review candidates | `ai-result-consumer.service.ts` |
| 33 | `backend/src/services/ai-result-consumer.service.ts` | Consumes Python results in the background | `schemas/jobs.py` |
| 34 | `backend/ai-service/relay_ai/schemas/jobs.py` | Defines Python transport envelopes | `schemas/meetings.py` |
| 35 | `backend/ai-service/relay_ai/schemas/meetings.py` | Defines extraction input/output | `transcript_normalizer.py` |
| 36 | `backend/ai-service/relay_ai/services/transcript_normalizer.py` | Cleans transcript text | `transcript_chunker.py` |
| 37 | `backend/ai-service/relay_ai/services/transcript_chunker.py` | Bounds long-transcript context with safe overlap | `task_extraction.py` |
| 38 | `backend/ai-service/relay_ai/prompts/task_extraction.py` | Defines extraction rules | `task_extractor.py` |
| 39 | `backend/ai-service/relay_ai/providers/task_extractor.py` | Defines the provider interface | `groq.py` |
| 40 | `backend/ai-service/relay_ai/providers/groq.py` | Calls Groq and validates structured extraction output | `task_reconciler.py` |
| 41 | `backend/ai-service/relay_ai/services/task_reconciler.py` | Removes repeated chunk candidates deterministically | `meeting_graph.py` |
| 42 | `backend/ai-service/relay_ai/graphs/meeting_graph.py` | Coordinates chunked extraction and reconciliation | `redis_transport.py` |
| 43 | `backend/ai-service/relay_ai/redis_transport.py` | Reads jobs and publishes results | `worker.py` |
| 44 | `backend/ai-service/relay_ai/worker.py` | Runs the Python worker process | `api-client.ts` |
| 45 | `frontend/src/lib/api-client.ts` | Sends authenticated API requests | `auth-store.tsx` |
| 46 | `frontend/src/lib/auth-store.tsx` | Holds the user session | `relay-store.tsx` |
| 47 | `frontend/src/lib/relay-store.tsx` | Holds projects, meetings, tasks, and members | `app-shell.tsx` |
| 48 | `frontend/src/components/relay/app-shell.tsx` | Provides application navigation | `app.index.tsx` |
| 49 | `frontend/src/routes/app.index.tsx` | Shows the project overview | `app.meetings.index.tsx` |
| 50 | `frontend/src/routes/app.meetings.index.tsx` | Lists meetings | `app.upload.tsx` |
| 51 | `frontend/src/routes/app.upload.tsx` | Creates transcript meetings | `app.meetings.$meetingId.tsx` |
| 52 | `frontend/src/routes/app.meetings.$meetingId.tsx` | Shows transcript and linked tasks | `app.review.tsx` |
| 53 | `frontend/src/routes/app.review.tsx` | Shows the human review queue | `app.board.tsx` |
| 54 | `frontend/src/routes/app.board.tsx` | Shows the custom Kanban board | `task-detail-panel.tsx` |
| 55 | `frontend/src/components/relay/task-detail-panel.tsx` | Edits tasks with confirmation | `app.settings.tsx` |
| 56 | `frontend/src/routes/app.settings.tsx` | Manages project settings and members | `app.account.tsx` |
| 57 | `frontend/src/routes/app.account.tsx` | Manages personal account settings | Done |
