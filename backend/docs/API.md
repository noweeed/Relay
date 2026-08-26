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

Success responses use `{ "success": true, "data": ... }`. Errors use the shared `{ "success": false, "error": ... }` contract from the PRD.
