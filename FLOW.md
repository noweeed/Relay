# Relay System Flows

This document describes how requests, data, and responsibility move through Relay. It reflects the target architecture in the PRD and should be updated whenever a workflow boundary changes.

## 1. Runtime architecture

```text
Relay web frontend
       |
       | HTTPS REST / JSON
       | Socket.IO events
       v
Node.js / TypeScript / Express
       |
       |-- authentication and authorization
       |-- API validation and business rules
       |-- MongoDB persistence
       |-- human approval and confirmations
       |-- frontend-facing responses and events
       |
       +--------------------> MongoDB Atlas
       |
       +--------------------> Object storage
       |
       +-- versioned AI job --> Redis Streams
                                  |
                                  v
                           Python 3.12 worker
                           LangGraph + Pydantic
                                  |
                                  |-- LLM calls
                                  |-- transcription
                                  |-- extraction
                                  |-- embeddings
                                  |-- duplicate reasoning
                                  |-- command interpretation
                                  |
       <--- structured result ----+
       |
       v
Node validates and persists result
```

Node is the authoritative application layer. Python produces structured AI proposals and does not approve candidates, execute task mutations, or act as a second frontend-facing backend.

## 2. Manual task flow

```text
Owner/admin configures project columns
      |
      +--> stable UUID + display name + color
      +--> reporting category: todo / in_progress / done
      +--> complete ordered list persisted on Project
      |
      v
Members create or move tasks by stable columnId
```

Renaming, recoloring, or reordering a column does not rewrite tasks. Deleting a populated column requires another project column as its destination; task moves, activity entries, and column deletion share one MongoDB transaction.

```text
User submits task
      |
      v
Express route
      |
      v
Authentication + project membership check
      |
      v
Zod request validation
      |
      v
Task service applies business rules
      |
      +---> Task persisted in MongoDB
      +---> TaskActivity persisted
      +---> Socket.IO task event emitted to project room
      |
      v
Standard API response returned
```

The authenticated CRUD, filtering, grouped Kanban response, activity persistence, Socket.IO task events, and project overview aggregation are all implemented. This manual flow is independent of AI.

## 3. Transcript meeting flow

```text
User pastes transcript
      |
      v
Node authenticates user and verifies project membership
      |
      v
Node validates input and creates Meeting
      |
      v
Node stores normalized initial transcript input
      |
      v
Node publishes meeting.process job
      |
      v
Python meeting graph
      |
      |-- load authorized meeting context
      |-- normalize transcript
      |-- split long transcripts with segment overlap
      |-- extract task candidates per bounded chunk
      |-- reconcile repeated overlap candidates
      |-- suggest project-member assignees
      |-- generate embeddings
      |-- search for possible duplicates
      |-- prepare review result
      |
      v
Python publishes versioned structured result
      |
      v
Node validates schema and resource ownership
      |
      |-- persist transcript segments
      |-- persist task candidates
      |-- persist duplicate proposals
      |-- update Meeting status
      |-- mark jobId as applied
      |
      v
meeting.ready_for_review event
      |
      v
Human review
```

The transcript storage path is implemented in v0.4. In v0.5, Node dispatches stored meetings through Redis, the Python worker runs the `normalize → chunk → extract → reconcile → prepare review result` LangGraph, and Node validates and persists traceable candidates. Chunk overlap preserves local context; deterministic reconciliation removes candidates repeated because of that overlap. The review API keeps edits and decisions in Node and transactionally creates permanently sourced tasks only after approval.

## 4. Audio meeting flow

```text
User uploads MP3/WAV/M4A
      |
      v
Node validates MIME type and size
      |
      v
Node stores audio externally
      |
      v
Node creates Meeting and publishes AI job
      |
      v
Python transcription provider
      |
      v
Timestamped speaker segments
      |
      v
Normal transcript meeting flow
```

The request returns after the meeting and job are created. Processing continues asynchronously. Failed processing can be retried without uploading the audio again.

## 5. Candidate review flow

```text
Pending candidate
      |
      +--> Human edits candidate
      |
      +--> Reject
      |      |
      |      v
      |    Store rejected state for audit
      |
      +--> Approve
             |
             +--> No unresolved duplicate
             |      |
             |      v
             |    Node creates Task with source traceability
             |
             +--> Duplicate pending
                    |
                    v
                 Resolve duplicate first
```

AI extraction never silently creates a task.

## 6. Duplicate and cross-meeting update flow

```text
New task candidate
      |
      v
Python generates embedding
      |
      v
Project-scoped Atlas Vector Search
against todo + in_progress tasks
      |
      v
Threshold classification
      |
      +--> Below threshold: normal candidate
      |
      +--> Medium/high match
              |
              v
        Optional LLM verification
              |
              v
        Structured comparison returned to Node
              |
              v
        Human chooses one action
              |
              +--> Update existing task
              +--> Create separate task
              +--> Ignore
```

Python identifies and explains possible matches. Node applies the selected action only after authorization and human confirmation.

## 7. Natural-language command flow

```text
User enters project command
      |
      v
Node authenticates and creates command job
      |
      v
Python command graph interprets intent
      |
      +--> ambiguous reference
      |       |
      |       v
      |    Return candidate matches
      |
      +--> read-only intent
      |       |
      |       v
      |    Node executes authorized query
      |
      +--> state-changing intent
              |
              v
        Node stores confirmation preview
              |
              +--> Cancel: no mutation
              |
              +--> Confirm
                     |
                     v
               Node revalidates and executes
```

Python never executes a state-changing command.

## 8. Deadline notification flow

```text
Node BullMQ schedule
      |
      v
Deadline monitor queries open tasks
      |
      +--> due soon
      +--> overdue
      |
      v
Generate deterministic dedupeKey
      |
      +--> Already exists: do nothing
      |
      +--> New notification
              |
              +--> persist Notification
              +--> emit notification.created
              +--> optional integration delivery
```

Deadline calculation is deterministic Node business logic, not an LLM decision.

## 9. AI job lifecycle

```text
created
  |
  v
published
  |
  v
claimed by Python consumer group
  |
  +--> retryable provider failure --> bounded retry
  |
  +--> terminal failure ----------> sanitized failure result
  |
  +--> success -------------------> structured success result
                                           |
                                           v
                                  Node validation/application
                                           |
                         +-----------------+----------------+
                         |                                  |
                         v                                  v
                      applied                     rejected/dead-lettered
```

Every envelope includes `jobId`, `jobType`, `schemaVersion`, `projectId`, initiating user, timestamps, and correlation metadata. Result application is idempotent by `jobId`.

## 10. Error flow

```text
Request or processing error
      |
      v
Map internal failure to safe Relay error code
      |
      v
Log operational context without secrets
      |
      v
Return standard API error or sanitized AI failure result
```

Frontend API errors follow:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "fields": {}
  }
}
```

Provider secrets, raw stack traces, tokens, and private transcript content must not appear in frontend errors.
