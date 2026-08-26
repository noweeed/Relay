# Relay AI service

This directory is the Python 3.12+ boundary for Relay's LangGraph workflows, model calls, embeddings, transcription, and structured AI outputs.

The Redis Streams transport validates the same versioned job/result envelopes as Node. The meeting extraction graph is the next v0.5 implementation step.

From `D:\Relay\backend\ai-service`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m relay_ai.worker --check
python -m relay_ai.worker --check-transport
pytest
```

`--check-transport` reads `REDIS_URL` from `.env`, connects, sends a Redis `PING`, and exits. It does not consume any jobs.

Redis messages use one `envelope` field containing JSON. `redis_transport.py` validates every job before Python handles it and validates every result before publishing it back to Node.

The Python service must not become a second application backend. Node authorizes jobs and persists validated results.
