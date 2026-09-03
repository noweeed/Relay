import pytest

from relay_ai.schemas.meetings import MeetingProcessPayload
from relay_ai.services.transcript_normalizer import normalize_transcript


def payload_with_segments(segments: list[dict[str, object]]) -> MeetingProcessPayload:
    """Create a valid graph payload around the supplied normalization examples."""
    return MeetingProcessPayload.model_validate(
        {
            "meetingId": "meeting-1",
            "title": "Planning meeting",
            "meetingDate": "2026-08-28",
            "segments": segments,
        }
    )


def test_normalizes_unicode_whitespace_and_segment_order() -> None:
    payload = payload_with_segments(
        [
            {"segmentId": "segment-2", "order": 2, "text": "  Ship\t it   Friday  "},
            {
                "segmentId": "segment-1",
                "order": 1,
                "speaker": " Ｎａｖｅｅｄ ",
                "text": "  I’ll\u00a0handle auth. ",
            },
        ]
    )

    normalized = normalize_transcript(payload)

    assert [segment.segment_id for segment in normalized] == ["segment-1", "segment-2"]
    assert normalized[0].speaker == "Naveed"
    assert normalized[0].text == "I’ll handle auth."
    assert normalized[0].order == 1


def test_rejects_a_transcript_that_becomes_empty() -> None:
    payload = payload_with_segments([{"segmentId": "segment-1", "order": 0, "text": "   "}])

    with pytest.raises(ValueError, match="no usable text"):
        normalize_transcript(payload)
