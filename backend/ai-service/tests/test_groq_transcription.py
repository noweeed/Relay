import asyncio
from types import SimpleNamespace

import pytest

from relay_ai.providers.groq_transcription import GroqTranscriptionProvider
from relay_ai.schemas.meetings import AudioMeetingPayload


class FakeTranscriptions:
    def __init__(self) -> None:
        self.request: dict[str, object] = {}

    async def create(self, **request: object) -> object:
        self.request = request
        return SimpleNamespace(
            text="First sentence. Second sentence.",
            segments=[
                SimpleNamespace(text=" First sentence. ", start=0.25, end=1.5),
                SimpleNamespace(text="Second sentence.", start=1.5, end=3.75),
            ],
        )


class FakeGroqClient:
    def __init__(self) -> None:
        self.transcriptions = FakeTranscriptions()
        self.audio = SimpleNamespace(transcriptions=self.transcriptions)


def audio_payload() -> AudioMeetingPayload:
    return AudioMeetingPayload.model_validate(
        {
            "meetingId": "meeting-1",
            "title": "Recorded planning",
            "meetingDate": "2026-09-03",
            "projectMembers": [],
            "audio": {
                "downloadUrl": "https://relay.example/audio.wav?signature=signed",
                "mimeType": "audio/wav",
                "originalName": "planning.wav",
            },
        }
    )


def test_normalizes_groq_verbose_segments_to_milliseconds() -> None:
    client = FakeGroqClient()
    provider = GroqTranscriptionProvider(api_key="test-key", client=client)

    segments = asyncio.run(provider.transcribe(audio_payload()))

    assert [segment.text for segment in segments] == ["First sentence.", "Second sentence."]
    assert segments[0].start_ms == 250
    assert segments[1].end_ms == 3750
    assert segments[0].speaker is None
    assert client.transcriptions.request["url"] == audio_payload().audio.download_url
    assert client.transcriptions.request["response_format"] == "verbose_json"
    assert client.transcriptions.request["timestamp_granularities"] == ["segment"]


def test_rejects_a_transcription_with_no_spoken_text() -> None:
    client = FakeGroqClient()

    async def empty_response(**_request: object) -> object:
        return SimpleNamespace(text="", segments=[])

    client.transcriptions.create = empty_response  # type: ignore[method-assign]
    provider = GroqTranscriptionProvider(api_key="test-key", client=client)

    with pytest.raises(ValueError, match="no spoken text"):
        asyncio.run(provider.transcribe(audio_payload()))
