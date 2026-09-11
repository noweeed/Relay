# Atlas Vector Search setup

Relay uses Atlas Vector Search only to propose possible duplicates. It never merges or changes a task without a human decision.

## Create the index

Create a Vector Search index on the `tasks` collection using [`backend/config/atlas-vector-index.json`](../config/atlas-vector-index.json). The default index name is `task_embedding_index`.

The index dimension must equal `EMBEDDING_DIMENSIONS`. The checked-in definition uses 1536 dimensions for `gemini-embedding-001`. If the embedding model or dimensions change, rebuild the index with the matching value before enabling duplicate detection.

## Configure the Python worker

Set these variables for the AI worker:

```dotenv
GEMINI_API_KEY=your-gemini-key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=1536
ATLAS_VECTOR_INDEX=task_embedding_index
DUPLICATE_MEDIUM_THRESHOLD=0.80
DUPLICATE_HIGH_THRESHOLD=0.90
```

The worker reuses `MONGODB_URI` and derives the database name from that URI. Give its MongoDB user read-only permission for the Relay database. Node remains the only process allowed to persist candidates, resolve duplicate suggestions, or mutate tasks.

Search is restricted twice: the job contains only the current project's open Todo/In Progress column IDs, and the aggregation filters by both `projectId` and those column IDs. The filter fields are included in the vector index definition.

Relay retrieves up to ten vector candidates. It rejects obvious same-template/different-subject
matches (for example, Redis versus Supabase), then asks the configured Groq model to classify
the remaining candidates as the same work, related but separate, or unrelated. A duplicate is
shown only when the verifier returns `same_work`. Retrieval scores and verifier decisions are
written to the worker logs for threshold tuning.

After creating or rebuilding the Atlas index, queue embeddings for all existing tasks:

```powershell
cd backend
npm run backfill:task-embeddings
```
