"""Deterministic transcript cleanup used before any model sees meeting text."""

import unicodedata

from relay_ai.schemas.meetings import MeetingProcessPayload, TranscriptSegmentInput


def normalize_text(value: str) -> str:
    """Normalize Unicode and collapse all runs of whitespace to one plain space."""
    normalized = unicodedata.normalize("NFKC", value)
    return " ".join(normalized.split())


def normalize_transcript(payload: MeetingProcessPayload) -> list[TranscriptSegmentInput]:
    """Return ordered, cleaned segments while preserving permanent IDs and order values."""
    normalized_segments: list[TranscriptSegmentInput] = []
    for segment in sorted(payload.segments, key=lambda item: item.order):
        text = normalize_text(segment.text)
        if not text:
            continue

        speaker = normalize_text(segment.speaker) if segment.speaker else None
        normalized_segments.append(
            segment.model_copy(update={"text": text, "speaker": speaker or None})
        )

    if not normalized_segments:
        raise ValueError("meeting transcript contains no usable text after normalization")
    return normalized_segments
