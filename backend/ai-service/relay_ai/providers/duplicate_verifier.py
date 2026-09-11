"""Provider-neutral boundary for verifying vector duplicate candidates."""

from dataclasses import dataclass
from typing import Literal, Protocol

from relay_ai.providers.similarity_search import TaskSimilarityMatch
from relay_ai.schemas.meetings import ExtractedTask

DuplicateDecision = Literal["same_work", "related_but_separate", "unrelated"]


@dataclass(frozen=True)
class DuplicateVerification:
    """One model decision tied to the existing task it evaluated."""

    existing_task_id: str
    decision: DuplicateDecision


class DuplicateVerifier(Protocol):
    """Reranks retrieved tasks by deciding whether they represent the same work."""

    async def verify_duplicates(
        self,
        candidate: ExtractedTask,
        matches: list[TaskSimilarityMatch],
    ) -> list[DuplicateVerification]:
        """Classify every supplied match without inventing task identifiers."""
        ...
