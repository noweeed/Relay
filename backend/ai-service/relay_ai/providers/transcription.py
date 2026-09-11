"""Provider-neutral boundary for timestamped meeting transcription."""

from typing import Protocol

from relay_ai.schemas.meetings import AudioMeetingPayload, TranscribedSegment


class TranscriptionProvider(Protocol):
    """Describes the audio operation required before task extraction."""

    async def transcribe(self, payload: AudioMeetingPayload) -> list[TranscribedSegment]:
        """Return ordered timestamped text without making biometric identity claims."""
        ...
