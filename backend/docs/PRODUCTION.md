# Production configuration

Relay production consists of three processes: the Node API, the Python AI worker, and Redis/MongoDB infrastructure. Build the frontend separately and set its API and Socket.IO URLs to the public Node origin.

## Required secrets and services

- `MONGODB_URI`: a TLS MongoDB connection string. The Node account needs application read/write access; the Python account used for duplicate search should be read-only.
- `REDIS_URL`: a TLS Redis connection string shared by Node and Python.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AUDIO_SIGNING_SECRET`: three different random values of at least 32 characters. Store them in the platform secret manager and rotate them deliberately.
- `GROQ_API_KEY`: extraction and audio transcription.
- `GEMINI_API_KEY`: embeddings used by duplicate detection.
- S3-compatible credentials when `AUDIO_STORAGE_PROVIDER=s3`.

Never commit `.env`, provider credentials, database URLs, Redis URLs, or generated signed audio URLs.

## Node API settings

Set `NODE_ENV=production`, `FRONTEND_URL` to the exact browser origin, and `API_PUBLIC_URL` to the public HTTPS API origin. Set `TRUST_PROXY=true` only when exactly one trusted reverse proxy or platform load balancer sits in front of Node. Relay then trusts one proxy hop for client IP handling.

Authentication defaults to 30 attempts per 15 minutes. Costly AI routes default to 20 requests per signed-in user per 15 minutes. Tune `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX`, `AI_ROUTE_RATE_LIMIT_WINDOW_MS`, and `AI_ROUTE_RATE_LIMIT_MAX` for expected traffic. Multiple API replicas require a shared `express-rate-limit` store before relying on a global cross-replica limit; the built-in memory store limits each replica independently.

For audio, production should use `AUDIO_STORAGE_PROVIDER=s3`. Configure `S3_REGION`, `S3_BUCKET`, and credentials; set `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` only when the provider requires them. Keep the bucket private.

## Python worker settings

Use the same stream names and schema versions as Node. Leave consumer names blank so each process gets a unique name. Provider calls retry three times by default with exponential backoff; exhausted jobs publish a contract-valid failure and a dead-letter record.

Deploy the Atlas vector index from [`../config/atlas-vector-index.json`](../config/atlas-vector-index.json) before enabling portfolio duplicate demos. Detailed setup is in [`ATLAS_VECTOR_SEARCH.md`](ATLAS_VECTOR_SEARCH.md).

## Release checks

From `backend/`:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

From `backend/ai-service/` with its virtual environment active:

```powershell
python -m ruff check .
python -m mypy relay_ai
python -m pytest
python -m relay_ai.worker --check
python -m relay_ai.worker --check-transport
```

Build the frontend with `npm run build`. After deployment, verify `/health`, `/docs.json`, login/refresh, one transcript job, one worker result, and an authenticated Socket.IO connection.

