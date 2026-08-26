# Relay AI service

This directory is the Python 3.12+ boundary for Relay's future LangGraph workflows, model calls, embeddings, transcription, and structured AI outputs.

In v0.1 it provides the package, configuration model, shared envelope models, and a startup check. The Redis Streams worker loop and meeting graph arrive with the extraction/async milestones described in the PRD.

From `D:\Relay\backend\ai-service`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m relay_ai.worker --check
pytest
```

The Python service must not become a second application backend. Node authorizes jobs and persists validated results.
