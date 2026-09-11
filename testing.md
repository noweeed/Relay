# Relay complete testing guide

This guide tests the full Relay project: public pages, authentication, projects, roles, board,
tasks, multiple assignees, comments, activity history, meetings, AI processing, duplicate handling,
notifications, commands, real-time updates, security boundaries, and failure recovery.

Use a fresh test database. Do not use production accounts, keys, recordings, or customer data.

## 1. Result key

For every test, record one result:

- `[PASS]` The observed result exactly matches the expected result.
- `[FAIL]` The result is wrong. Add a screenshot, API response, and browser console error if present.
- `[BLOCKED]` Required infrastructure or a provider is unavailable.
- `[N/A]` The feature is intentionally disabled for this test environment.

Do not mark the project complete if any release-blocking test fails.

## 2. UI and API coverage

Project update/delete, admin/member access, member removal, and full board-column management are
available in Project Settings. Swagger remains useful for direct API validation and permission-edge
tests, but a normal user does not need it for these actions.

## 3. Required tools and services

- Node.js 20 or newer
- Python 3.12 or newer
- MongoDB or MongoDB Atlas
- Redis
- A modern Chromium browser, plus Firefox or Safari for a second-browser check
- Groq key for real task extraction and audio transcription
- Gemini key and an Atlas vector-search index for real duplicate detection
- Optional Google OAuth client ID for Google sign-in
- One valid MP3, WAV, or M4A file smaller than 25 MB
- One fake audio file whose extension is `.wav` but whose contents are plain text
- One image smaller than 5 MB and one image larger than 5 MB

## 4. Environment setup

### 4.1 Backend

From `D:\Relay\backend`:

```powershell
Copy-Item .env.example .env
npm install
```

Set at least these values in `backend/.env`:

```env
MONGODB_URI=<test database URI>
JWT_ACCESS_SECRET=<long random test secret>
JWT_REFRESH_SECRET=<different long random test secret>
REDIS_URL=<test Redis URL>
FRONTEND_URL=http://localhost:3000
API_PUBLIC_URL=http://localhost:5000
AUDIO_SIGNING_SECRET=<different random value of at least 32 characters>
```

For the full real-provider test, also set:

```env
GROQ_API_KEY=<test key>
GEMINI_API_KEY=<test key>
MONGODB_DATABASE=<test database name>
ATLAS_VECTOR_INDEX=task_embedding_index
TRANSCRIPTION_PROVIDER=groq
```

Optional Google login:

```env
GOOGLE_CLIENT_ID=<test OAuth client ID>
```

For faster deadline testing, the smallest allowed interval is:

```env
DEADLINE_MONITOR_INTERVAL_MS=60000
DEADLINE_UPCOMING_HOURS=24
```

Keep `AUDIO_STORAGE_PROVIDER=local` for the normal local test. Run a separate S3 test if production
uses S3, R2, or MinIO.

### 4.2 Python worker

From `D:\Relay\backend\ai-service`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

Copy the required Redis, Groq, Gemini, MongoDB, stream, model, and threshold values from the backend
environment into `backend/ai-service/.env`.

### 4.3 Frontend

From `D:\Relay\frontend`:

```powershell
Copy-Item .env.example .env
npm install
```

Use:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=<same test Google client ID, or leave empty>
```

### 4.4 Start order

1. Start MongoDB and Redis.
2. In `D:\Relay\backend`, run `npm run dev`.
3. In `D:\Relay\backend\ai-service`, activate the virtual environment and run
   `python -m relay_ai.worker`.
4. In `D:\Relay\frontend`, run `npm run dev`.
5. Open `http://localhost:3000`.

Expected:

- Backend listens on port 5000.
- Frontend listens on port 3000.
- The Python worker connects to Redis without consuming malformed jobs.
- No secret or full transcript is printed in logs.

## 5. Automated baseline

Run these before manual testing.

### 5.1 Frontend

From `D:\Relay\frontend`:

```powershell
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit successfully. Existing lint warnings must be reviewed, but there must be
no lint errors.

### 5.2 Node backend

From `D:\Relay\backend`:

```powershell
npm run typecheck
npm run lint
npm run build
npm test
npm run ai:check
```

Expected: all tests and checks pass. This covers API contracts, tokens, auth boundaries, project
privacy, roles, task lifecycle, comments, task activity, Kanban columns, meetings, audio validation,
candidate review, duplicate resolution, notifications, commands, rate limits, and OpenAPI coverage.

### 5.3 Python worker

From `D:\Relay\backend\ai-service` with the virtual environment active:

```powershell
ruff check .
mypy relay_ai
pytest
python -m relay_ai.worker --check
python -m relay_ai.worker --check-transport
```

Expected: tests, lint, typing, configuration check, and Redis ping pass.

## 6. Test identities and clean data

Create four unique accounts. Use a new timestamp or number in each email.

| Name         | Project access | Task state                     |
| ------------ | -------------- | ------------------------------ |
| Olivia Owner | owner          | not required                   |
| Adam Admin   | admin          | not required                   |
| Amy Assignee | member         | assigned to selected tasks     |
| Noah Member  | member         | not assigned to selected tasks |

Use passwords of 12–72 characters. Keep the credentials only in the local test notes.

Create one project named `Relay QA <date>`. Do not run `npm run seed` for the clean-data test.

## 7. Foundation, health, documentation, and errors

### FND-01 API root

1. Open `http://localhost:5000/api`.
2. Confirm the response is JSON.

Expected: HTTP 200 and Relay API information.

### FND-02 Healthy database

1. Open `http://localhost:5000/health` while MongoDB is running.

Expected: HTTP 200 and `database.status` is `connected`.

### FND-03 Degraded database

1. Stop the test MongoDB service.
2. Request `/health` again.
3. Restart MongoDB before continuing.

Expected: the API stays reachable, returns HTTP 503, and reports a disconnected/degraded database.

### FND-04 API documentation

1. Open `http://localhost:5000/docs`.
2. Open `http://localhost:5000/docs.json`.

Expected: Swagger loads and the JSON contains every public route used in this guide.

### FND-05 Unknown route

1. Request `http://localhost:5000/api/does-not-exist`.

Expected: HTTP 404 using the standard `{ success: false, error: ... }` shape. No stack trace is
returned.

## 8. Homepage and responsive shell

### WEB-01 Homepage content

1. Open `/` while signed out.
2. Confirm the header has Product, How it works, Features, Sign in, and Get started.
3. Confirm the hero explains meeting → review → board.
4. Confirm the product preview shows a transcript, proposed task, multiple assignees, source quote,
   and possible duplicate choices.
5. Scroll through the workflow, source/timeline, duplicate, controls, and final call-to-action areas.

Expected: all sections render; the primary color is `#F95E5E`; there are no fake testimonials,
company-logo walls, fake usage numbers, gradient text, or “Powered by AI” pills.

### WEB-02 Homepage links

1. Click Product, How it works, and Features.
2. Click both Get started buttons.
3. Go back and click Sign in.

Expected: section links scroll to the correct section, Get started opens `/signup`, and Sign in
opens `/login`.

### WEB-03 Responsive layout

1. Test widths 320, 375, 768, 1024, and 1440 pixels.
2. Check the homepage, auth forms, overview, board, meetings, review, settings, and account pages.
3. On mobile, open and close the navigation drawer.
4. On the board, confirm horizontal scrolling works without cutting off tasks.

Expected: no horizontal page overflow except the intentional board scroller; text is readable;
dialogs fit the viewport; the mobile navigation closes after selecting a page.

### WEB-04 Theme

1. Sign in and switch light/dark theme from the sidebar.
2. Refresh the page.
3. Test cards, dialogs, dropdowns, error text, success text, and the dark homepage section.

Expected: the theme changes, remains after refresh, and all content has readable contrast.

### WEB-05 Not found and error page

1. Open `/missing-page`.
2. Trigger a safe frontend API failure by stopping the backend and refreshing `/app/board`.
3. Restart the backend.

Expected: the 404 page is clear; the application error state does not expose secrets; retry or
refresh works after the backend returns.

## 9. Authentication and sessions

### AUTH-01 Sign-up validation

1. Open `/signup`.
2. Submit an empty form.
3. Try a one-character name, invalid email, and password shorter than 12 characters.

Expected: each invalid field is rejected and no account is created.

### AUTH-02 Sign up

1. Create Olivia Owner with a valid name, unique email, and 12–72 character password.
2. Repeat for Adam, Amy, and Noah.

Expected: each account is created, signed in, and directed to project setup. Emails are treated
case-insensitively.

### AUTH-03 Duplicate account

1. Try signing up again with Olivia's email using different letter casing.

Expected: the request is rejected without revealing sensitive account details.

### AUTH-04 Login validation

1. Sign out.
2. Try an invalid email, wrong password, and an unknown account.
3. Log in with the correct password.

Expected: invalid logins fail safely; the correct login opens `/app`.

### AUTH-05 Protected routes

1. Sign out.
2. Directly open `/app`, `/app/board`, `/app/meetings`, `/app/review`, and `/app/settings`.
3. Request `GET /api/projects` without a bearer token in Swagger or an API client.

Expected: the UI redirects to login and the API returns HTTP 401.

### AUTH-06 Refresh rotation

1. Sign in.
2. Refresh the browser after the short-lived access token expires, or call the refresh endpoint
   using the existing HTTP-only cookie.
3. Try calling refresh without the cookie.

Expected: the valid session receives a new access token and rotated cookie; missing/old refresh
credentials fail; the raw refresh token is not visible to page JavaScript.

### AUTH-07 Logout

1. Sign in, then use the profile menu → Sign out.
2. Use browser Back and try a protected API request.

Expected: the refresh session is revoked and protected content cannot be reopened.

### AUTH-08 Change password

1. Open Account settings → Security → Change password.
2. Try the wrong current password, a new password below 12 characters, and mismatched confirmation.
3. Change to a valid new password.
4. Confirm old sessions are revoked, the old password fails, and the new password works.

Expected: only the valid change succeeds.

### AUTH-09 Google sign-in

Run only when both Google client IDs are configured.

1. Use Sign up with Google on sign-up.
2. Sign out and use Sign in with Google on login.
3. Test an existing password account with the same verified Google email.

Expected: the account is created or linked safely; no duplicate user is created; a Google-only
account does not show the password-change button.

### AUTH-10 Trusted-origin and rate-limit boundaries

1. Send a browser-like mutation from an untrusted Origin.
2. Send the same valid request from `http://localhost:3000`.
3. In a disposable test environment, exceed the auth request limit.

Expected: cross-site mutation is rejected, trusted origin succeeds, and excessive requests receive
HTTP 429 without blocking a different authenticated user.

## 10. Projects, privacy, and roles

### PRJ-01 Empty state and no automatic demo data

1. Use a fresh database and do not run the seed command.
2. Sign in with a new user.

Expected: no demo project, meeting, candidate, task, notification, or activity appears. Marketing
examples on the public homepage are static illustrations, not account data.

### PRJ-02 Create project

1. From `/app/new-project`, submit no name and a one-character name.
2. Create `Relay QA <date>` with a description.

Expected: invalid names fail; the valid project is created; the creator is owner; Todo, In Progress,
and Done columns exist.

### PRJ-03 Multiple projects and switcher

1. Create a second project.
2. Use the project switcher to move between them.

Expected: overview, board, meetings, review queue, members, and notifications change to the selected
project without data leaking between projects.

### PRJ-04 Add existing member

1. Sign in as Olivia and open Project settings.
2. Add Amy by email with team role `QA engineer`.
3. Try invalid email, unknown email, duplicate member, and team-role text shorter than 2 or longer
   than 60 characters.

Expected: the valid existing user is added as a member; invalid cases fail; no invitation email is
sent because outbound invitations are not implemented.

### PRJ-05 Create an admin

1. Sign in as Olivia and open Project settings.
2. Add Adam by email, select `Admin` access, and enter a team role.
3. Add Noah as a normal member.

Expected: Adam has admin access, Noah has member access, and only this project's members can read it.

### PRJ-06 Edit descriptive team role

1. As owner, change Amy's team role to `Product QA`.
2. Sign in as admin and change it again.
3. Sign in as Noah and confirm no edit control is shown.

Expected: owner/admin changes persist; Amy's authorization remains `member`; Noah is blocked.

### PRJ-07 Project privacy

1. Create a fifth user who is not a project member.
2. Try the project, members, task, meeting, transcript, audio, review, and overview endpoints using
   known IDs from Olivia's project.

Expected: every request is rejected. Knowing an ID must not grant access.

### PRJ-08 Ownership transfer

1. As Olivia, transfer ownership to Adam.
2. Refresh both sessions.
3. Confirm Adam is owner and Olivia remains admin.
4. As a normal member, try the ownership-transfer endpoint.

Expected: transfer is atomic; exactly one owner remains; member request is HTTP 403.

### PRJ-09 Remove member

1. As owner/admin, use the remove button beside Noah in Project settings and confirm.
2. Confirm Noah immediately loses access to project REST data, Socket.IO rooms, and future deadline
   notifications.
3. Try removing the owner and try an admin removing the owner.

Expected: normal member removal succeeds; owner protection works.

### PRJ-10 Update project

1. As owner/admin, change the name and description in Project settings and click Save changes.
2. Refresh the frontend and confirm both values remain.
3. Sign in as Amy and confirm the fields are read-only and no save control is shown.
4. For server enforcement, try the PATCH endpoint as Amy in Swagger or an API client.

Expected: owner/admin change persists and member gets HTTP 403.

### PRJ-11 Project Settings save feedback

1. In the UI, change project name/description and click Save changes.
2. Refresh.

Expected: the success message appears only after the API accepts the change, and the saved values
remain after refresh. An API error is shown instead of a false success message.

### PRJ-12 Delete project

Run near the end because it destroys project test data.

1. Create a disposable project containing a meeting, transcript, task, activity, candidate,
   duplicate proposal, comment, notification, command, and stored audio.
2. As admin/member, confirm the delete control is hidden and try the endpoint directly to verify
   server enforcement.
3. As owner, open Project settings, type the exact project name, and delete it.
4. Confirm all dependent records and locally/S3-stored audio are gone.

Expected: only owner succeeds; deletion is complete.

### PRJ-13 Project Settings delete feedback

1. Create another disposable project.
2. In Settings, type its exact name and click Delete project.
3. Refresh and inspect the project list.

Expected: the UI navigates only after the API succeeds, and the deleted project does not return
after refresh. An API error keeps the dialog open and shows the error.

## 11. Overview dashboard

### OVR-01 Empty overview

1. Select a new project with no tasks or meetings.
2. Open Overview.

Expected: zero/empty states render without sample account data.

### OVR-02 Overview aggregation

1. Create Todo, In Progress, Done, upcoming, and overdue tasks.
2. Create meetings in processing, ready, completed, and failed states.
3. Perform task edits and moves.
4. Refresh Overview.

Expected: task counts, completion progress, upcoming deadlines, recent meetings, review count, and
recent activity agree with the source records and selected project.

### OVR-03 Overview links

1. Open a deadline task, recent meeting, review item, and activity link from Overview.

Expected: each link opens the correct record or page.

## 12. Kanban columns

### COL-01 Default columns

1. Create a project.

Expected: Todo, In Progress, and Done appear in order with stable IDs and correct reporting
categories.

### COL-02 Add a column

1. As owner/admin, open Project settings and click Add column.
2. Try an invalid one-character name and invalid color in the dialog.
3. Create a valid column with name, six-digit hex color, and category.

Expected: validation works and the new empty column appears without rewriting existing tasks.

### COL-03 Column permissions

1. Sign in as a member.
2. Confirm Add column is hidden.
3. Try create, update, reorder, and delete column endpoints.

Expected: all member mutations return HTTP 403; listing columns still works.

### COL-04 Rename, recolor, recategorize, and reorder

1. In Project settings, edit a column's name, color, and reporting category.
2. Use the move controls to reorder every column.
3. Refresh the board and overview.

Expected: display updates; tasks stay attached by stable column ID; overview uses the new category.

### COL-05 Maximum and duplicate order validation

1. Create columns until the project has 20.
2. Try creating number 21.
3. Try a reorder list with repeated, missing, or foreign column IDs.

Expected: all invalid operations fail without partially changing the board.

### COL-06 Delete empty and populated columns

1. Delete an empty non-protected column.
2. Try deleting a populated column without `moveTasksToColumnId`.
3. Retry with a valid destination column.
4. Try deleting the last Todo-category column.

Expected: empty deletion succeeds; populated deletion requires a destination; tasks and activity move
atomically; the final Todo category is protected.

### COL-07 Migration

Only for a copy of a legacy database:

```powershell
cd D:\Relay\backend
npm run migrate:kanban-columns
npm run migrate:kanban-columns
```

Expected: legacy statuses are backfilled correctly and the second run changes nothing.

## 13. Manual tasks, multiple assignees, and board controls

### TSK-01 Create task

1. Click Board → Add task.
2. Try an empty and one-character title.
3. Create a task with title, description, two assignees (Amy and Noah), due date, priority, and
   column.

Expected: invalid titles fail; the valid task appears once in the chosen column and shows both
assignees.

### TSK-02 Assignee validation

1. Create/update through Swagger with duplicate assignee IDs, more than 20 assignees, a non-member
   ID, and both legacy `assigneeId` plus `assigneeIds`.

Expected: all invalid requests fail; no partial task is created or updated.

### TSK-03 Search and filters

1. Create tasks with different titles, assignees, and high/medium/low priorities.
2. Search by partial title.
3. Filter by each assignee and priority.
4. Combine search + assignee + priority.
5. Clear filters.

Expected: only matching tasks show; counts match; clearing restores all tasks.

### TSK-04 API filters and grouping

Use Swagger to test `columnId`, `assignee`, `priority`, `dueAfter`, `dueBefore`, `q`, and
`groupBy=column` on `GET /api/projects/:projectId/tasks`.

Expected: filters are project-scoped; grouped output follows column order and includes empty columns.

### TSK-05 Open and close details

1. Click a task card.
2. Close with the X, Cancel button, Escape, and outside-click where supported.

Expected: correct task opens and closes without losing saved data.

### TSK-06 Edit as owner/admin/assignee

1. As owner, edit title, description, column, multiple assignees, priority, and due date.
2. Confirm the save dialog, then refresh.
3. Repeat a change as admin.
4. Repeat a change as Amy while Amy is assigned.

Expected: each authorized edit persists once and refreshes the task activity list.

### TSK-07 Block unassigned member edits

1. Create a task assigned only to Amy.
2. Sign in as Noah.
3. Open the task and try editing fields or dragging it.
4. Call the PATCH endpoint directly as Noah.

Expected: fields are disabled, drag does not start, and the API returns HTTP 403.

### TSK-08 Unsaved-change protection

1. Change a task field but do not save.
2. Try closing the panel.
3. Choose Keep editing, then try again and choose Discard.

Expected: accidental loss is prevented; discard restores server values.

### TSK-09 Drag and move

1. As owner/admin/assignee, drag a task between columns.
2. Refresh.
3. As unassigned Noah, try dragging Amy's task.

Expected: authorized move persists and creates activity; unauthorized move is blocked.

### TSK-10 Task deletion

1. As member/assignee, try DELETE through the API.
2. As admin/owner, delete a disposable task and confirm the dialog.

Expected: only owner/admin can delete; the task disappears and cannot be fetched again.

## 14. Task comments and edit timeline

### CMT-01 Comment as owner, admin, and assignee

1. Open a task assigned to Amy.
2. Add one comment as owner, one as admin, and one as Amy.
3. Refresh after each.

Expected: all comments persist in time order with correct author and timestamp; each comment adds a
timeline/activity entry.

### CMT-02 Block unassigned member comment

1. Sign in as Noah while Noah is not assigned to the task.
2. Open the task.
3. Try the comment API directly.

Expected: the UI says only owner, admin, or assignee can comment; no comment box is shown; API returns
HTTP 403.

### CMT-03 Comment validation

1. Try empty/whitespace-only text and text longer than 2,000 characters.
2. Add multiline text with normal punctuation.

Expected: invalid comments fail; valid multiline text is preserved safely and is not interpreted as
HTML/script.

### ACT-01 Full edit timeline

1. Create a task.
2. Change each field separately: title, description, column, assignees, priority, and due date.
3. Add and remove assignees.
4. Add a comment.
5. Open Activity and refresh.

Expected: timeline shows who acted, when, the action, and field-level before/after changes. Creation,
move, assignment, edit, comment, extraction/approval, and duplicate-update entries appear when their
events occur.

### ACT-02 Timeline privacy and immutability

1. As a project member, read task activity.
2. As a non-member, try the same endpoint.
3. Confirm there is no edit/delete activity endpoint.

Expected: members can read it, outsiders cannot, and history cannot be rewritten from the UI/API.

## 15. Transcript meetings

Use this transcript for the main happy path:

```text
Olivia (00:10): Amy will finish the login tests by Friday.
Amy (00:24): I will also update the release checklist by Monday.
Noah (00:40): The authentication task is still in progress and should stay high priority.
```

### MTG-01 Transcript validation and parsing

1. Open Add meeting → Transcript.
2. Try missing title, missing transcript, title longer than 200, and transcript longer than 500,000
   characters through the API.
3. Create meetings using `Name: text`, `[Name] text`, `Name (HH:MM): text`, plain text, blank lines,
   and consecutive lines by the same speaker.

Expected: invalid data fails; supported speaker formats parse into ordered segments; consecutive same
speaker lines merge; plain text remains usable without invented speakers.

### MTG-02 Processing lifecycle

1. Submit the happy-path transcript while Node, Redis, Python worker, and providers are running.
2. Watch Meetings and the meeting-detail status.

Expected: status moves created/saved → processing → ready for review (or completed after review);
Socket.IO updates it without requiring a refresh; candidates appear only after validated persistence.

### MTG-03 Meeting list search and filters

1. Create meetings in Saved, Processing, Ready, Completed, and Failed states.
2. Search by title and use every status filter.

Expected: rows, counts, creator, segments, linked-task count, and badges are correct.

### MTG-04 Meeting detail

1. Open a meeting.
2. Check metadata, Transcript tab, Linked tasks tab, timestamps, speakers, source links, and counts.
3. Copy the transcript and paste it into a local text editor.
4. Open a linked task from both tabs.

Expected: content matches stored data, Copy copies the complete transcript, and task links open the
correct detail panel.

### MTG-05 Meeting privacy

1. Try meeting list, detail, transcript, tasks, status, and source access as a non-member.

Expected: every endpoint denies access.

### MTG-06 Long transcript

1. Submit a transcript larger than `TRANSCRIPT_CHUNK_MAX_CHARS` with one action item near each chunk
   boundary and one repeated item in the overlap.

Expected: processing is bounded/concurrent, boundary items are found, and overlap does not create
duplicate candidates.

### MTG-07 Reprocessing and failure

1. Stop the Python worker or use an invalid provider key, then submit a meeting.
2. Wait for bounded retries and terminal failure.
3. Restore the worker/key.
4. As owner/admin, click Reprocess.
5. As a member, try the reprocess API.

Expected: failure is sanitized, the meeting becomes retryable, owner/admin retry reuses stored input,
and member retry is HTTP 403.

### MTG-08 Administrative status update

1. Through Swagger, call `PATCH /api/projects/:projectId/meetings/:meetingId/status` as owner, admin,
   and member using valid and invalid status values.

Expected: owner/admin can apply a valid transition, member receives HTTP 403, invalid values fail,
and the meeting list/detail reflect the saved state.

## 16. Audio meetings and storage

### AUD-01 Valid formats

1. Upload one valid MP3, WAV, and M4A, each below 25 MB.
2. Open each meeting after processing.

Expected: upload returns promptly, audio is stored under an opaque key, transcription has millisecond
timestamps, and normal task extraction follows.

### AUD-02 Invalid uploads

1. Try no file, more than one file, unsupported MIME type, a file over 25 MB, and a fake `.wav`
   containing text.

Expected: all fail with safe `AUDIO_*`/validation errors; no meeting or orphaned object remains.

### AUD-03 Private playback/download

1. Fetch meeting audio as a member.
2. Try the same URL as a non-member and after removing the member.
3. Wait for a worker signed URL to expire and try it again.

Expected: member succeeds; other access fails; signed URL is short-lived and does not expose a local
filesystem path or permanent storage credential.

### AUD-04 Audio retry

1. Force transcription failure.
2. Restore the provider and reprocess as owner/admin without re-uploading.

Expected: stored audio is reused and exactly one final transcript/candidate set is applied.

### AUD-05 S3-compatible storage

Run only if production uses it.

1. Set `AUDIO_STORAGE_PROVIDER=s3` and valid endpoint/bucket credentials.
2. Repeat valid upload, access, retry, project deletion, and unauthorized access tests.

Expected: behavior matches local storage and deleted projects remove their audio objects.

## 17. Candidate review

### REV-01 Candidate traceability

1. Open Review after a processed meeting.
2. Check title, suggested assignee, deadline, priority, confidence label, quote, speaker, and timestamp.

Expected: each candidate points to a real stored transcript segment and the quote is verbatim.

### REV-02 Edit candidate

1. Edit assignee, due date, and priority.
2. Refresh before approving.
3. Try assigning a non-member through the API.

Expected: valid edits persist; non-member assignment fails.

### REV-03 Approve

1. Approve one normal candidate.
2. Open Board and the new task.

Expected: one Todo task is created only after approval; source meeting, segment, quote, and timestamp
remain attached; extracted and approved activity entries exist; repeated approval fails safely.

### REV-04 Reject

1. Reject another candidate.
2. Refresh Review and inspect history through the API.

Expected: no task is created; candidate remains stored as rejected history.

### REV-05 Bulk approve and reject

1. Select multiple normal pending candidates from the same meeting.
2. Bulk approve them.
3. Select other pending candidates and bulk reject them.
4. Include one invalid/already-decided ID in an API request.

Expected: valid batches complete atomically; an invalid batch creates no partial results; duplicate
pending candidates cannot be selected for normal bulk approval.

### REV-06 Human-review rule

1. Process a meeting and do not approve anything.
2. Search the board and task API.

Expected: no extracted candidate becomes a task automatically.

## 18. Duplicate detection and cross-meeting updates

Prerequisite: Atlas vector index and Gemini embeddings are configured. Create an open board task named
`Finalize authentication flow`, assigned to Amy, high priority, due soon. Then process a later meeting
that says Amy will finish the authentication API with a changed deadline or priority.

### DUP-01 Detection and safe UI

1. Open the later meeting's Review page.

Expected: medium/high likely match shows the existing task, confidence label, field differences, and
Update existing / Create separate task / Ignore. The raw similarity score is not exposed.

### DUP-02 Update existing

1. As owner/admin/assignee, choose Update existing.
2. Open the original task.

Expected: no second task is created; proposed changed fields are applied; timeline records actor,
later meeting, segment, quote, and differences.

### DUP-03 Update permission

1. As unassigned Noah, open a duplicate proposal for Amy's task.
2. Try Update existing in UI and API.

Expected: button is disabled with a clear reason and API returns HTTP 403.

### DUP-04 Create separate

1. Generate another possible duplicate and choose Create separate task.

Expected: a new sourced task is created and the original stays unchanged.

### DUP-05 Ignore

1. Generate another possible duplicate and choose Ignore.

Expected: no task is created or changed; candidate remains rejected/ignored history.

### DUP-06 Resolution safety

1. Resolve the same duplicate twice.
2. Try resolving it from another project using known IDs.
3. Try normal edit/approve while status is `duplicate_pending`.

Expected: repeat, cross-project, and bypass attempts fail; no partial mutation occurs.

### DUP-07 Scope and completed work

1. Create similar tasks in two projects and one Done-category task.
2. Process the matching meeting in only one project.

Expected: search is limited to the same project's open Todo/In Progress work; other-project and Done
tasks are not proposed.

## 19. Natural-language command bar

Open with the header search or Ctrl/Cmd+K.

### CMD-01 Read-only overdue query

1. Create overdue and non-overdue tasks.
2. Run `What tasks are overdue?`.

Expected: results are project-scoped and correct; no confirmation is requested and no task changes.

### CMD-02 Move command and confirmation

1. Run `Move <unique task title> to Done`.
2. Read the preview but do not confirm yet; inspect the board in another tab.
3. Click Confirm.

Expected: no mutation before confirmation; one move occurs after confirmation; activity records the
actor and change.

### CMD-03 Assign command and confirmation

1. Run `Assign <unique task title> to Amy`.
2. Confirm the preview.

Expected: Amy is added/assigned only after confirmation and assignment activity appears.

### CMD-04 Cancel

1. Run a valid state-changing command.
2. Click Cancel.

Expected: command is cancelled and the task remains unchanged.

### CMD-05 Ambiguous reference

1. Create two tasks with similar names.
2. issue a command using only the shared words.

Expected: Relay lists candidates and does not silently pick or mutate either task.

### CMD-06 Permissions and stale preview

1. As unassigned Noah, try moving or assigning Amy's task through a command.
2. Create a valid preview as Amy, then have the owner delete or materially change the target before
   Amy confirms.

Expected: unauthorized command is blocked and confirmation revalidates stale targets safely.

### CMD-07 Processing failure and recovery

1. Stop the Python worker after creating a command, or force a terminal provider failure.
2. Confirm the UI eventually shows a timeout/failure rather than spinning forever.
3. Test recovery of a command left in executing state using the automated integration suite.

Expected: safe error, no mutation, and recoverable command state.

### CMD-08 Command ownership

1. Create a command as Amy.
2. As another project member, try to fetch, confirm, and cancel Amy's command using its ID.

Expected: only the initiating user can control or read the command record; project membership alone
does not grant access to another user's command.

## 20. Notifications and deadlines

### NOT-01 Upcoming deadline

1. Assign Amy an open task due within the configured upcoming window.
2. Wait for the deadline worker interval.
3. Open Amy's notification panel.

Expected: one upcoming notification appears for Amy and a real-time unread dot/count updates.

### NOT-02 Overdue task

1. Assign Amy an open task with a past due date.
2. Wait for the monitor.

Expected: one overdue notification appears.

### NOT-03 Recipient rules

1. Test a task assigned to multiple users.
2. Test an unassigned task created by Noah.
3. Test a Done-category task.

Expected: every current assignee receives one private notification, unassigned work falls back to its
creator, and Done work is ignored.

### NOT-04 No duplicate alerts

1. Leave the same due date unchanged across at least two monitor runs.

Expected: recipient/task/type/due-date dedupe creates only one notification.

### NOT-05 Changed due date

1. Change the due date after an alert, then wait for the monitor.

Expected: a correct alert for the new due date can be created without duplicating the old key.

### NOT-06 Read state

1. Open the notification panel.
2. Toggle one notification read and unread.
3. Click Mark all read.
4. Refresh.

Expected: read state persists and unread count/dot is correct.

### NOT-07 Notification privacy

1. As one user, try reading or changing another user's notification by ID.

Expected: access is denied.

### NOT-08 Preferences

1. In Account settings, toggle every preference separately: upcoming deadlines, overdue tasks,
   meeting processing, review queue, mentions/assignments, weekly digest, email, and in-app.
2. Refresh after each change.
3. Disable upcoming/overdue or all in-app notifications and trigger matching events.

Expected: preferences persist and suppressed notification types are not delivered in-app.

Note: where an external delivery such as email or weekly digest has no configured sender/job, mark
that delivery `[N/A]` rather than claiming it was sent. Preference persistence must still pass.

### NOT-09 Removed member

1. Create a future deadline for Noah.
2. Remove Noah before the monitor runs.

Expected: Noah receives no new project notification.

### NOT-10 List filters, limit, and disabled monitor

1. Through Swagger, list notifications with `projectId`, `unreadOnly`, and different valid `limit`
   values; try a foreign project ID and invalid limit.
2. Restart Node with `DEADLINE_MONITOR_ENABLED=false`, create a due task, and wait longer than the
   normal interval.
3. Restore the setting after the test.

Expected: filters and limits are correct and private, invalid input fails, and disabling the monitor
prevents both its repeat schedule and deadline worker from creating alerts.

## 21. Real-time events and multi-session behavior

Use two separate browsers or profiles.

### RT-01 Task events

1. Open the same board as Olivia and Amy.
2. Create, update, move, comment on, and delete disposable tasks from one session.

Expected: the other authorized session updates without a full refresh and receives no duplicate
records.

### RT-02 Meeting progress

1. Keep meeting detail open in one session while submitting/processing in another.

Expected: progress and ready/failed states update in real time.

### RT-03 Notification event

1. Keep Amy signed in while creating a notification for Amy.

Expected: notification appears and unread indicator updates without refresh.

### RT-04 Room isolation

1. Keep users from two different projects connected.
2. Generate task, meeting, and notification events in only one project.

Expected: only authorized project/user rooms receive them.

### RT-05 Reconnect

1. Disconnect network briefly or restart the backend.
2. Restore it and refresh/reconnect.

Expected: the application reloads authoritative state and does not duplicate events.

### RT-06 Socket authentication

1. Try connecting Socket.IO without a token, with an altered token, and with a valid token.
2. Remove a connected member from a project and generate another project event.

Expected: invalid clients cannot join private rooms; valid client succeeds; removed member receives no
later project event.

## 22. Profile and account

### ACC-01 Profile name

1. Try a one-character name and a name over 80 characters.
2. Save a valid new name and refresh.

Expected: validation works and valid name appears throughout the UI.

### ACC-02 Profile image

1. Upload PNG, JPG, and WebP images under 5 MB.
2. Check the resulting avatar dimensions/data and refresh.
3. Try a file over 5 MB and an unsupported type.

Expected: valid images resize to at most 200px and persist; invalid files fail; the original large
file is not stored by the browser flow.

### ACC-02B Remove profile image through the API

1. Through Swagger, call `PATCH /api/auth/me` with `avatarUrl: null`.
2. Refresh the frontend.

Expected: the saved avatar is removed and the initials fallback appears.

### ACC-03 Email field

1. Open Account settings.

Expected: email is correct and read-only.

### ACC-04 Account deletion protection

1. While the user owns a project, type `delete my account` and provide the password.
2. Transfer ownership, then try a wrong password.
3. Finally use the correct password on a disposable user.

Expected: owners must transfer projects first; wrong password fails; valid deletion removes login and
memberships and revokes sessions.

## 23. API contracts and security

Use Swagger or an API client. Never paste real secrets into saved collections.

### SEC-01 Standard response shape

1. Sample successful and failing auth, project, task, meeting, review, notification, and command
   requests.

Expected: success is `{ "success": true, "data": ... }`; failure is
`{ "success": false, "error": { "code", "message", ... } }`.

### SEC-02 Validation

1. Send malformed ObjectIds, UUIDs, dates, priorities, statuses, colors, empty PATCH bodies, overly
   long fields, and extra invalid enum values.

Expected: HTTP 400 with useful field errors and no database mutation.

### SEC-03 Token boundary

1. Use an access token at the refresh boundary.
2. Use a refresh token as bearer access.
3. Use expired, altered, or wrong-secret tokens.

Expected: all are rejected.

### SEC-04 Private fields

1. Inspect API responses, logs, browser storage, and Socket.IO payloads.

Expected: no password hash, raw refresh token, provider key, storage credential, internal stack,
private transcript from another project, or raw duplicate similarity score leaks.

### SEC-05 Expensive-route rate limit

1. In a disposable environment, exceed `AI_ROUTE_RATE_LIMIT_MAX` for transcript, audio, reprocess,
   or command requests as one user.
2. Try as a second authenticated user.

Expected: first user gets HTTP 429; second user's independent allowance remains available.

### SEC-06 HTML/script handling

1. Put `<script>alert(1)</script>` in names, project text, task text, comments, and transcript text.

Expected: content is displayed as text or rejected; no script executes.

### SEC-07 Audio path and signature safety

1. Modify an audio storage key/signature/expiry in a signed media request.

Expected: tampered and expired access fails without revealing storage paths.

## 24. AI transport, persistence, and recovery

Most of these are covered automatically; also observe them in a disposable integration environment.

### AI-01 Contract compatibility

1. Run both Node and Python contract-fixture tests.

Expected: both runtimes accept the same versioned transcript, audio, command, and result envelopes.

### AI-02 Idempotent result application

1. Replay the same valid result/job ID.

Expected: Node applies it once; no duplicate segments, candidates, tasks, or activity appear.

### AI-03 Ownership validation

1. Alter project/meeting/user identifiers in a result envelope.

Expected: Node rejects/dead-letters it and changes no application data.

### AI-04 Malformed message

1. Publish malformed JSON and a schema-invalid job/result in the test stream.

Expected: it is rejected or dead-lettered safely; the consumer continues processing later valid work.

### AI-05 Consumer recovery

1. Stop a consumer after it claims but before it acknowledges a job.
2. Wait past `AI_PENDING_IDLE_MS` and start another consumer.

Expected: stale delivery is reclaimed, durable result is written once, then the message is
acknowledged.

### AI-06 Provider retries

1. Simulate a retryable provider failure and then recovery.
2. Simulate repeated failure through the maximum attempts.

Expected: exponential bounded retries occur; terminal failure is sanitized and dead-lettered.

### AI-07 Embedding freshness

1. Change task text while an older embedding refresh is in flight.

Expected: an embedding is applied only if it matches the current task text.

### AI-08 Worker authority boundary

1. Inspect Python code/tests and live results.

Expected: Python only returns structured proposals. It never writes application state, approves a
candidate, updates a task, or serves a frontend endpoint.

## 25. Logging, observability, and operations

### OPS-01 Correlation and useful logs

1. Process a meeting and command while watching Node and worker logs.

Expected: job/correlation IDs and state changes make the request traceable across runtimes without
logging secrets or full private content.

### OPS-02 Provider outage

1. Follow `backend/docs/RUNBOOK.md` to simulate and recover from a provider outage.

Expected: safe user state, bounded retry, actionable logs, and successful retry after recovery.

### OPS-03 API/consumer restart

1. Restart Node while jobs/results are pending.
2. Restart the worker while jobs are pending.

Expected: durable Redis groups and idempotent application prevent loss or duplicates.

### OPS-04 Production configuration review

1. Follow every checklist item in `backend/docs/PRODUCTION.md` and
   `backend/docs/SECURITY_PRIVACY.md`.
2. Verify production uses strong unique secrets, TLS, trusted origins, correct proxy settings,
   private storage, backups, log retention, rate limits, and a read-only Python MongoDB account.

Expected: no production review item is left open.

### OPS-05 Task embedding backfill

Run only on a disposable database with the Atlas vector index and embedding provider configured:

```powershell
cd D:\Relay\backend
npm run backfill:task-embeddings
```

Run it again after completion.

Expected: eligible current tasks receive embeddings, failures are reported safely, and the second run
does not corrupt or unnecessarily duplicate current embeddings.

## 26. Seed and demo script

Demo data is not loaded automatically.

### DEMO-01 Explicit seed only

1. On a separate disposable database, set `SEED_USER_PASSWORD`.
2. Run:

```powershell
cd D:\Relay\backend
npm run seed
```

3. Follow `backend/demo/portfolio-demo.json`.
4. Run the seed again.

Expected: demo data appears only after the explicit command, uses the documented login/story, and
the deterministic seed does not create uncontrolled duplicates.

### DEMO-02 Fresh database remains empty

1. Switch back to a new database where seed was never run.
2. Create a new account.

Expected: all application data starts empty.

## 27. Final cross-browser and accessibility pass

### QA-01 Keyboard

1. Complete signup/login, project creation, task creation/edit, comment, review, notification, command,
   and settings flows using only keyboard.
2. Check Tab order, Enter/Space actions, Escape on dialogs, and Ctrl/Cmd+K.

Expected: focus is visible, order is logical, dialogs trap/restore focus, and every main action is
reachable.

### QA-02 Screen-reader names

1. Inspect icon buttons, inputs, switches, tables, status controls, and dialogs with a screen reader
   or browser accessibility tree.

Expected: controls have clear names; headings are ordered; tables have headers; errors are
understandable.

### QA-03 Browser matrix

1. Run the main happy path in current Chrome/Edge and Firefox.
2. If Safari is a supported production target, repeat there.

Expected: auth cookies, drag/drop, clipboard, uploads, avatar resize, sockets, and layout behave
consistently.

### QA-04 Slow and failed network

1. Use browser developer tools to test slow network, offline mode, and HTTP 400/401/403/404/409/429/
   500/503 responses.

Expected: buttons show progress, double submission is prevented, errors are clear, and optimistic
state rolls back when persistence fails.

## 28. Final release gate

The project may be called ready only when:

- All automated checks pass.
- Every applicable manual test above is marked `[PASS]`.
- Any `[N/A]` has a written reason.
- No `[BLOCKED]` remains for a production-required provider or service.
- No authorization, privacy, data-loss, duplicate-mutation, or traceability test fails.
- The two current Project Settings API-wiring gaps are fixed and their tests pass.
- A fresh unseeded account contains no demo data.
- Multiple assignees work in create, edit, display, filtering, commands, and notifications.
- Only owner, admin, or an assignee can edit/comment on the protected task.
- Task activity shows who changed what and when.
- Candidate approval and duplicate updates always require a human action.
- The complete transcript → review → board → later-meeting update demo succeeds twice without stale
  or duplicate data.

## 29. Test run record

Copy this block for each release candidate:

```text
Build/commit:
Tester:
Date:
Environment:
Browser(s):
MongoDB:
Redis:
AI providers:
Automated result:
Manual PASS count:
Manual FAIL count:
Manual BLOCKED count:
Manual N/A count:
Release decision:
Notes and issue links:
```
