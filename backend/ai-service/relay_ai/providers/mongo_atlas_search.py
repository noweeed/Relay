"""MongoDB Atlas Vector Search adapter for project-scoped open tasks."""

import asyncio
from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId
from pymongo import MongoClient

from relay_ai.providers.similarity_search import TaskSimilarityMatch
from relay_ai.schemas.meetings import TaskPriority


class MongoAtlasTaskSimilaritySearch:
    """Runs read-only `$vectorSearch` queries against Relay's task collection."""

    def __init__(
        self,
        *,
        mongodb_uri: str,
        database: str | None,
        index_name: str,
        collection_name: str = "tasks",
        client: MongoClient[dict[str, Any]] | None = None,
    ) -> None:
        self._owns_client = client is None
        self._client = client or MongoClient(mongodb_uri)
        if database:
            self._database = self._client[database]
        else:
            default = self._client.get_default_database()
            if default is None:
                raise ValueError("MONGODB_DATABASE is required when MONGODB_URI has no database")
            self._database = default
        self._collection = self._database[collection_name]
        self._index_name = index_name

    async def search(
        self,
        *,
        project_id: str,
        open_column_ids: list[str],
        embedding: list[float],
        limit: int = 5,
    ) -> list[TaskSimilarityMatch]:
        if not open_column_ids:
            return []

        def run_query() -> list[dict[str, Any]]:
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": self._index_name,
                        "path": "embedding",
                        "queryVector": embedding,
                        "numCandidates": max(limit * 20, 100),
                        "limit": limit,
                        "filter": {
                            "$and": [
                                {"projectId": ObjectId(project_id)},
                                {"columnId": {"$in": open_column_ids}},
                            ]
                        },
                    }
                },
                {
                    "$project": {
                        "title": 1,
                        "description": 1,
                        "assigneeId": 1,
                        "dueDate": 1,
                        "priority": 1,
                        "score": {"$meta": "vectorSearchScore"},
                    }
                },
            ]
            return list(self._collection.aggregate(pipeline))

        rows = await asyncio.to_thread(run_query)
        matches: list[TaskSimilarityMatch] = []
        for row in rows:
            raw_due = row.get("dueDate")
            due_date = None
            if isinstance(raw_due, datetime):
                due_date = raw_due.astimezone(UTC).date()
            elif isinstance(raw_due, date):
                due_date = raw_due
            matches.append(
                TaskSimilarityMatch(
                    task_id=str(row["_id"]),
                    title=str(row["title"]),
                    description=str(row["description"]) if row.get("description") else None,
                    assignee_id=str(row["assigneeId"]) if row.get("assigneeId") else None,
                    due_date=due_date,
                    priority=TaskPriority(str(row.get("priority", "medium"))),
                    score=float(row["score"]),
                )
            )
        return matches

    def close(self) -> None:
        if self._owns_client:
            self._client.close()
