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

1. `providers/transcription.py` defines timestamped speech-to-text; `providers/groq_transcription.py` implements it with Groq Whisper and signed audio URLs.
2. `services/transcript_normalizer.py` performs deterministic Unicode and whitespace cleanup.
3. `services/transcript_chunker.py` groups whole segments within a configurable character budget, adds a small segment overlap, and splits only an individually oversized segment.
4. `providers/task_extractor.py` defines the model-independent extraction boundary.
5. `services/task_reconciler.py` deterministically removes repeated evidence/action candidates while preferring the most complete, highest-confidence result.
6. `graphs/meeting_graph.py` coordinates normalization, bounded concurrent extraction, reconciliation, evidence validation, and result preparation.

`providers/mock.py` supplies a deterministic, no-network extractor for graph and worker tests. Shared job/result examples in `tests/fixtures/` are validated by both Python and Node so contract drift fails in CI.

This keeps provider code replaceable and prevents generated candidates from losing their permanent transcript segment references.

Task extraction requires these values when the provider is actually invoked:

```env
GROQ_API_KEY=your-groq-key
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_TIMEOUT_SECONDS=60
GROQ_MAX_COMPLETION_TOKENS=800
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_TRANSCRIPTION_LANGUAGE=
GROQ_TRANSCRIPTION_TIMEOUT_SECONDS=120
GEMINI_API_KEY=your-gemini-key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=1536
EMBEDDING_TIMEOUT_SECONDS=30
MONGODB_URI=your-read-only-atlas-uri
MONGODB_DATABASE=
ATLAS_VECTOR_INDEX=task_embedding_index
DUPLICATE_MEDIUM_THRESHOLD=0.80
DUPLICATE_HIGH_THRESHOLD=0.90
TRANSCRIPT_CHUNK_MAX_CHARS=12000
TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS=1
TRANSCRIPT_CHUNK_CONCURRENCY=3
AI_WORKER_CONSUMER_GROUP=relay-ai-workers
AI_WORKER_CONSUMER_NAME=
AI_JOB_MAX_ATTEMPTS=3
AI_RETRY_BASE_DELAY_MS=500
AI_PENDING_IDLE_MS=30000
```

`GROQ_MODEL` defaults to `qwen/qwen3.8-27b`. `GROQ_MAX_COMPLETION_TOKENS`
defaults to `800` so free-tier output-token limits are not exceeded by one request. Relay
calls Groq directly; no OpenAI account, key, or provider setting is involved.

`GROQ_TRANSCRIPTION_MODEL` defaults to `whisper-large-v3-turbo`. Segment timestamps come from Groq's `verbose_json` response. Whisper does not provide reliable speaker diarization, so Relay does not invent names or claim biometric identities; speaker labels remain empty unless a future transcription provider supplies neutral diarization labels.

For v0.8, the worker calls Google's native Gemini `batchEmbedContents` API, embeds each extracted candidate, and searches only the same project's open Todo/In Progress tasks. It retrieves ten candidates, filters obvious named-subject conflicts, and uses Groq to verify the remaining matches. Only a verified `same_work` result at or above the configured medium threshold becomes a duplicate proposal. The Python MongoDB account should be read-only. Python can propose a match, but only Node can persist it or apply the human's Update existing, Create separate, or Ignore decision. See [`../docs/ATLAS_VECTOR_SEARCH.md`](../docs/ATLAS_VECTOR_SEARCH.md) for the index definition and setup.

The chunk size is based on normalized transcript characters rather than provider-specific token counts. Keep it below the selected model's input limit after allowing room for the prompt, schema, meeting metadata, and output. Overlap improves context across boundaries; reconciliation prevents overlap from creating duplicate review candidates. Concurrency bounds simultaneous provider calls for one meeting.

Leave `AI_WORKER_CONSUMER_NAME` empty to generate a unique host/process name. Failed provider calls retry with exponential backoff. Jobs are acknowledged only after the result (and, for terminal failures, the dead-letter record) is safely written.

The Python service must not become a second application backend. Node authorizes jobs and persists validated results.
