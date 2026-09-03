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

Audio uploads currently complete the first v0.7 boundary: multipart parsing, a configurable size limit, MIME plus container-signature validation, filename sanitization, opaque local storage, meeting metadata, and authenticated retrieval. The endpoint returns after durable storage. Transcription/job dispatch and hosted object-storage adapters remain pending, so new audio meetings remain in `created` until that stage is connected.

Candidate review endpoints:

- `GET /api/projects/:projectId/meetings/:meetingId/candidates` — optionally filter by `status`
- `PATCH /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId`
- `POST /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId/approve`
- `POST /api/projects/:projectId/meetings/:meetingId/candidates/:candidateId/reject`
- `POST /api/projects/:projectId/meetings/:meetingId/candidates/bulk-approve`
- `POST /api/projects/:projectId/meetings/:meetingId/candidates/bulk-reject`

All project members may review candidates. Edits accept `title`, `description`, `suggestedAssigneeId`, `suggestedDueDate`, and `suggestedPriority`; the assignee must still belong to the project. Bulk actions accept `{ "candidateIds": ["..."] }` and commit atomically within one meeting. Approval creates a Todo task and permanently copies the meeting ID, transcript segment ID, verbatim quote, and timestamp onto its `source`. The task's `extracted` and `approved` activity records and the candidate's `createdTaskId` are written in the same transaction. Rejected candidates remain stored for history.

Success responses use `{ "success": true, "data": ... }`. Errors use the shared `{ "success": false, "error": ... }` contract from the PRD.
