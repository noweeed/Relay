"""Deterministic provider used by tests and local contract demonstrations."""

from collections.abc import Sequence

from relay_ai.providers.similarity_search import TaskSimilarityMatch
from relay_ai.schemas.meetings import (
    AudioMeetingPayload,
    ExtractedTask,
    MeetingProcessPayload,
    TranscribedSegment,
    TranscriptSegmentInput,
)


class StaticTaskExtractor:
    """Returns predefined structured tasks without making a network request."""

    def __init__(self, tasks: Sequence[ExtractedTask]) -> None:
        self._tasks = [task.model_copy(deep=True) for task in tasks]
        self.calls: list[tuple[MeetingProcessPayload, list[TranscriptSegmentInput]]] = []

    async def extract_tasks(
        self,
        payload: MeetingProcessPayload,
        segments: list[TranscriptSegmentInput],
    ) -> list[ExtractedTask]:
        self.calls.append((payload.model_copy(deep=True), list(segments)))
        return [task.model_copy(deep=True) for task in self._tasks]


class StaticTranscriptionProvider:
    """Returns predefined timestamped segments without reading audio or using biometrics."""

    def __init__(self, segments: Sequence[TranscribedSegment]) -> None:
        self._segments = [segment.model_copy(deep=True) for segment in segments]
        self.calls: list[AudioMeetingPayload] = []

    async def transcribe(self, payload: AudioMeetingPayload) -> list[TranscribedSegment]:
        self.calls.append(payload.model_copy(deep=True))
        return [segment.model_copy(deep=True) for segment in self._segments]


class StaticEmbeddingProvider:
    """Returns predefined vectors for deterministic graph tests."""

    def __init__(self, vectors: Sequence[Sequence[float]]) -> None:
        self._vectors = [list(vector) for vector in vectors]
        self.calls: list[list[str]] = []

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(list(texts))
        if len(texts) != len(self._vectors):
            raise ValueError("Static embedding count does not match input count")
        return [list(vector) for vector in self._vectors]


class StaticTaskSimilaritySearch:
    """Returns predefined task matches without accessing MongoDB Atlas."""

    def __init__(self, matches: Sequence[TaskSimilarityMatch]) -> None:
        self._matches = list(matches)
        self.calls: list[tuple[str, list[str], list[float]]] = []
        self.limits: list[int] = []

    async def search(
        self,
        *,
        project_id: str,
        open_column_ids: list[str],
        embedding: list[float],
        limit: int = 5,
    ) -> list[TaskSimilarityMatch]:
        self.calls.append((project_id, list(open_column_ids), list(embedding)))
        self.limits.append(limit)
        return self._matches[:limit]
