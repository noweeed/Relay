# Relay API

The frontend-facing API uses the unversioned `/api` prefix.

Foundation endpoints:

- `GET /health` — application and MongoDB connection health
- `GET /api` — API information
- `GET /docs` — Swagger UI
- `GET /docs.json` — OpenAPI document

Authentication endpoints:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `PATCH /api/auth/me/password`
- `PUT /api/auth/me/notifications`
- `DELETE /api/auth/me`
- `POST /api/auth/google`

Access tokens are returned in JSON and sent as `Authorization: Bearer <token>`. Refresh JWTs are rotated through a secure HTTP-only cookie and backed by a hashed, revocable MongoDB session.

Notification endpoints:

- `GET /api/notifications` — supports `projectId`, `unreadOnly`, and `limit`
- `PATCH /api/notifications/:notificationId/read` — body `{ "read": true | false }`
- `POST /api/notifications/read-all`

Deadline monitoring runs in a Node BullMQ worker. It ignores Done-category tasks, classifies due dates deterministically, honors the recipient's in-app and deadline preferences, and emits `notification.created` to the authenticated user's private Socket.IO room. The assignee is the default recipient; unassigned tasks fall back to their creator. A recipient/task/type/due-date key prevents repeated scans from creating duplicates.

Project endpoints:

- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `GET /api/projects/:projectId/members`
- `POST /api/projects/:projectId/members/invite`
- `PATCH /api/projects/:projectId/members/:userId`
- `DELETE /api/projects/:projectId/members/:userId`
- `POST /api/projects/:projectId/transfer-ownership`

The invite endpoint adds an existing Relay user by email; outbound email invitations are not sent yet.
Its `teamRole` field is a free-text descriptive title such as `Frontend engineer`. It is separate from
the authorization `role` (`owner`, `admin`, or `member`). Owners/admins can edit `teamRole` later
without changing the member's access permissions.

Task and Kanban endpoints:

- `GET /api/projects/:projectId/kanban/columns`
- `POST /api/projects/:projectId/kanban/columns` — owner/admin
- `PATCH /api/projects/:projectId/kanban/columns/:columnId` — owner/admin
- `PUT /api/projects/:projectId/kanban/columns/order` — owner/admin
- `DELETE /api/projects/:projectId/kanban/columns/:columnId` — owner/admin
- `GET /api/projects/:projectId/tasks`
- `POST /api/projects/:projectId/tasks`
- `GET /api/projects/:projectId/tasks/:taskId`
- `PATCH /api/projects/:projectId/tasks/:taskId`
- `DELETE /api/projects/:projectId/tasks/:taskId`
- `GET /api/projects/:projectId/tasks/:taskId/activity`

Every project starts with Todo, In Progress, and Done columns. Owners/admins may add, rename, recolor, categorize, reorder, and delete columns. A populated column can be deleted only with `moveTasksToColumnId`; its tasks and activity records move atomically. The final Todo-category column is protected.

Natural-language command endpoints:

- `POST /api/projects/:projectId/commands` — enqueue project-scoped interpretation
- `GET /api/projects/:projectId/commands/:commandId` — poll the initiating user's command
- `POST /api/projects/:projectId/commands/:commandId/confirm`
- `POST /api/projects/:projectId/commands/:commandId/cancel`

The Python command graph currently understands task moves, assignments, and overdue-task questions. It receives only authorized project context and returns structured intent, candidates, and a preview. Node executes read-only queries itself. Mutations remain unchanged until the initiating user confirms; Node revalidates the target and records normal task activity during execution. Ambiguous names return candidates rather than selecting one silently.

Tasks store stable `columnId` values, so renaming a column does not rewrite tasks. Task lists accept `columnId`, `assignee`, `priority`, `dueAfter`, `dueBefore`, and `q` filters. Passing `groupBy=column` returns ordered column metadata and task arrays, including empty columns. Every task endpoint checks project membership; task deletion additionally requires an owner or admin role.

Transcript meeting endpoints:

- `POST /api/projects/:projectId/meetings` — create a transcript meeting and queue extraction
- `POST /api/projects/:projectId/meetings/transcript` — explicit alias for transcript creation
- `POST /api/projects/:projectId/meetings/audio` — multipart upload with `title` and one `audio` file
- `GET /api/projects/:projectId/meetings` — list meetings, optionally filtered by status
- `GET /api/projects/:projectId/meetings/:meetingId`
- `GET /api/projects/:projectId/meetings/:meetingId/transcript`
- `GET /api/projects/:projectId/meetings/:meetingId/audio` — membership-protected audio bytes
- `GET /api/projects/:projectId/meetings/:meetingId/tasks`
- `GET /api/projects/:projectId/meetings/:meetingId/status`
- `POST /api/projects/:projectId/meetings/:meetingId/reprocess` — retry a failed meeting

Meeting creation returns after Node stores the transcript and queues a versioned Redis job. The Python worker transparently chunks long transcripts, extracts bounded chunks concurrently, reconciles overlap duplicates, and returns a schema-validated result for Node to persist. This does not change the HTTP contract or bypass human review.

Audio uploads return after durable storage and job dispatch. Files use configurable local or S3-compatible storage. The Python worker receives a short-lived signed URL, calls the configured transcription provider, preserves millisecond segment timestamps, and runs the normal extraction graph. Node validates and atomically persists the transcript and candidates. Failed audio meetings reuse the stored object when reprocessed, so users do not upload it again.

Candidate review endpoints:

- `GET /api/projects/:projectId/meetings/:meetingId/candidates` — optionally filter by `status`
- `PATCH /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId`
- `POST /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId/approve`
- `POST /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId/reject`
- `POST /api/projects/:projectId/meetings/:meetingId/candidates/bulk-approve`
- `POST /api/projects/:projectId/meetings/:meetingId/candidates/bulk-reject`
- `POST /api/projects/:projectId/duplicates/:duplicateId/resolve` — body action is `update_existing`, `create_separate`, or `ignore`

All project members may review candidates. Edits accept `title`, `description`, `suggestedAssigneeId`, `suggestedDueDate`, and `suggestedPriority`; the assignee must still belong to the project. Bulk actions accept `{ "candidateIds": ["..."] }` and commit atomically within one meeting. Approval creates a Todo task and permanently copies the meeting ID, transcript segment ID, verbatim quote, and timestamp onto its `source`. The task's `extracted` and `approved` activity records and the candidate's `createdTaskId` are written in the same transaction. Rejected candidates remain stored for history.

Candidates with `status: "duplicate_pending"` include safe duplicate metadata but never expose the raw similarity score. They cannot use normal approval or editing until the suggestion is resolved. `update_existing` applies the proposed changed fields and records the later meeting, segment, quote, and differences in task activity; `create_separate` creates a normal sourced task; `ignore` keeps the candidate as rejected history. A repeated or cross-project resolution is rejected.

Success responses use `{ "success": true, "data": ... }`. Errors use the shared `{ "success": false, "error": ... }` contract from the PRD.
