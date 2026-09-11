"""Groq Whisper adapter for timestamped meeting transcription."""

from typing import Any

from groq import AsyncGroq

from relay_ai.schemas.meetings import AudioMeetingPayload, TranscribedSegment


class GroqTranscriptionProvider:
    """Calls Groq speech-to-text and normalizes verbose segments."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "whisper-large-v3-turbo",
        language: str | None = None,
        timeout_seconds: float = 120,
        client: Any | None = None,
    ) -> None:
        if not api_key.strip():
            raise ValueError("GROQ_API_KEY is required")
        self._model = model.strip()
        self._language = language.strip() if language else None
        self._owns_client = client is None
        self._client = client or AsyncGroq(api_key=api_key, timeout=timeout_seconds)

    async def transcribe(self, payload: AudioMeetingPayload) -> list[TranscribedSegment]:
        """Use a signed URL and retain Groq's segment-level timestamps."""
        if self._language:
            response = await self._client.audio.transcriptions.create(
                url=payload.audio.download_url,
                model=self._model,
                language=self._language,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
                temperature=0,
            )
        else:
            response = await self._client.audio.transcriptions.create(
                url=payload.audio.download_url,
                model=self._model,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
                temperature=0,
            )
        raw_segments = getattr(response, "segments", None) or []
        segments: list[TranscribedSegment] = []
        for raw in raw_segments:
            text = str(getattr(raw, "text", "")).strip()
            if not text:
                continue
            start = max(0, round(float(getattr(raw, "start", 0)) * 1_000))
            end = max(start, round(float(getattr(raw, "end", start / 1_000)) * 1_000))
            segments.append(
                TranscribedSegment(
                    order=len(segments),
                    text=text,
                    startMs=start,
                    endMs=end,
                )
            )
        if not segments:
            text = str(getattr(response, "text", "")).strip()
            if text:
                segments.append(TranscribedSegment(order=0, text=text, startMs=0, endMs=0))
        if not segments:
            raise ValueError("Transcription provider returned no spoken text")
        return segments

    async def close(self) -> None:
        if self._owns_client:
            await self._client.close()
