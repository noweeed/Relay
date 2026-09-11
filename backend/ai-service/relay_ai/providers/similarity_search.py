"""Read-only task similarity search boundary."""

from dataclasses import dataclass
from datetime import date
from typing import Protocol

from relay_ai.schemas.meetings import TaskPriority


@dataclass(frozen=True)
class TaskSimilarityMatch:
    """Minimal existing-task context returned by a project-scoped vector search."""

    task_id: str
    title: str
    description: str | None
    assignee_id: str | None
    due_date: date | None
    priority: TaskPriority
    score: float


class TaskSimilaritySearch(Protocol):
    """Searches only open tasks from one authorized project."""

    async def search(
        self,
        *,
        project_id: str,
        open_column_ids: list[str],
        embedding: list[float],
        limit: int = 5,
    ) -> list[TaskSimilarityMatch]:
        """Return nearest open tasks in descending similarity order."""
        ...
