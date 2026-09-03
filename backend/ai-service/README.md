# Relay AI service

This directory is the Python 3.12+ boundary for Relay's LangGraph workflows, model calls, embeddings, transcription, and structured AI outputs.

The Redis Streams transport validates the same versioned job/result envelopes as Node. Durable consumer groups keep jobs pending until their result is published, reclaim work after a stopped worker, and preserve terminal failures in the dead-letter stream. The meeting graph normalizes transcript segments, chunks long transcripts, invokes an injected task extractor for each chunk, reconciles repeated candidates, verifies source-segment references, and prepares a strict review result. The Groq adapter uses Groq's official Python SDK, the versioned extraction prompt, and Pydantic validation for every model response.

From `D:\Relay\backend\ai-service`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m relay_ai.worker --check
python -m relay_ai.worker --check-transport
python -m relay_ai.worker
pytest
```

`--check-transport` reads `REDIS_URL` from `.env`, connects, sends a Redis `PING`, and exits. It does not consume any jobs.
The normal worker command listens continuously. Use `python -m relay_ai.worker --once` to process currently available jobs and exit during local debugging.

Redis messages use one `envelope` field containing JSON. `redis_transport.py` validates every job before Python handles it and validates every result before publishing it back to Node.

The meeting pipeline is intentionally split by responsibility:

1. `services/transcript_normalizer.py` performs deterministic Unicode and whitespace cleanup.
2. `services/transcript_chunker.py` groups whole segments within a configurable character budget, adds a small segment overlap, and splits only an individually oversized segment.
3. `providers/task_extractor.py` defines the model-independent extraction boundary.
4. `services/task_reconciler.py` deterministically removes repeated evidence/action candidates while preferring the most complete, highest-confidence result.
5. `graphs/meeting_graph.py` coordinates normalization, bounded concurrent extraction, reconciliation, evidence validation, and result preparation.

`providers/mock.py` supplies a deterministic, no-network extractor for graph and worker tests. Shared job/result examples in `tests/fixtures/` are validated by both Python and Node so contract drift fails in CI.

This keeps provider code replaceable and prevents generated candidates from losing their permanent transcript segment references.

Task extraction requires these values when the provider is actually invoked:

```env
GROQ_API_KEY=your-groq-key
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_TIMEOUT_SECONDS=60
TRANSCRIPT_CHUNK_MAX_CHARS=12000
TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS=1
TRANSCRIPT_CHUNK_CONCURRENCY=3
AI_WORKER_CONSUMER_GROUP=relay-ai-workers
AI_WORKER_CONSUMER_NAME=
AI_JOB_MAX_ATTEMPTS=3
AI_RETRY_BASE_DELAY_MS=500
AI_PENDING_IDLE_MS=30000
```

`GROQ_MODEL` defaults to `qwen/qwen3.8-27b`. Relay calls Groq directly; no OpenAI account, key, or provider setting is involved.

The chunk size is based on normalized transcript characters rather than provider-specific token counts. Keep it below the selected model's input limit after allowing room for the prompt, schema, meeting metadata, and output. Overlap improves context across boundaries; reconciliation prevents overlap from creating duplicate review candidates. Concurrency bounds simultaneous provider calls for one meeting.

Leave `AI_WORKER_CONSUMER_NAME` empty to generate a unique host/process name. Failed provider calls retry with exponential backoff. Jobs are acknowledged only after the result (and, for terminal failures, the dead-letter record) is safely written.

The Python service must not become a second application backend. Node authorizes jobs and persists validated results.
