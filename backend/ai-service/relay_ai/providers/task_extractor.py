"""Provider-neutral boundary for structured meeting task extraction."""

from typing import Protocol

from relay_ai.schemas.meetings import (
    ExtractedTask,
    MeetingProcessPayload,
    TranscriptSegmentInput,
)


class TaskExtractor(Protocol):
    """Describes the only model-facing operation required by the meeting graph."""

    async def extract_tasks(
        self,
        payload: MeetingProcessPayload,
        segments: list[TranscriptSegmentInput],
    ) -> list[ExtractedTask]:
        """Return strict, evidence-backed candidates for normalized segments."""
        ...
