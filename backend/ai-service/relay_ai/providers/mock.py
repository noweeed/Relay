"""Deterministic provider used by tests and local contract demonstrations."""

from collections.abc import Sequence

from relay_ai.schemas.meetings import ExtractedTask, MeetingProcessPayload, TranscriptSegmentInput


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
