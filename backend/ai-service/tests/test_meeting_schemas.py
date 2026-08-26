from datetime import date

import pytest
from pydantic import ValidationError

from relay_ai.schemas.meetings import MeetingExtractionResult, MeetingProcessPayload


def valid_payload() -> dict[str, object]:
    """Build the smallest realistic meeting job payload for schema tests."""
    return {
        "meetingId": "meeting-1",
        "title": "Sprint planning",
        "meetingDate": "2026-08-26",
        "projectMembers": [{"userId": "user-1", "name": "Naveed"}],
        "segments": [
            {
                "segmentId": "segment-1",
                "order": 0,
                "speaker": "Naveed",
                "text": "I will finish authentication by Friday.",
            }
        ],
    }


def test_meeting_payload_accepts_ordered_project_context() -> None:
    payload = MeetingProcessPayload.model_validate(valid_payload())

    assert payload.meeting_date == date(2026, 8, 26)
    assert payload.segments[0].segment_id == "segment-1"


def test_meeting_payload_rejects_duplicate_segment_orders() -> None:
    payload = valid_payload()
    segments = payload["segments"]
    assert isinstance(segments, list)
    segments.append({"segmentId": "segment-2", "order": 0, "text": "Another line"})

    with pytest.raises(ValidationError, match="unique order"):
        MeetingProcessPayload.model_validate(payload)


def test_meeting_payload_rejects_backwards_timestamps() -> None:
    payload = valid_payload()
    segments = payload["segments"]
    assert isinstance(segments, list)
    first_segment = segments[0]
    assert isinstance(first_segment, dict)
    first_segment.update({"startMs": 2_000, "endMs": 1_000})

    with pytest.raises(ValidationError, match="endMs"):
        MeetingProcessPayload.model_validate(payload)


def test_extraction_result_serializes_using_node_field_names() -> None:
    result = MeetingExtractionResult.model_validate(
        {
            "meetingId": "meeting-1",
            "tasks": [
                {
                    "title": "Finish authentication API",
                    "assigneeName": "Naveed",
                    "dueDate": "2026-08-28",
                    "priority": "high",
                    "segmentOrder": 0,
                    "sourceQuote": "I will finish authentication by Friday.",
                    "confidence": 0.91,
                }
            ],
        }
    )

    serialized = result.model_dump(mode="json", by_alias=True)
    assert serialized["tasks"][0]["assigneeName"] == "Naveed"
    assert serialized["tasks"][0]["dueDate"] == "2026-08-28"


def test_extraction_result_rejects_invalid_confidence() -> None:
    with pytest.raises(ValidationError):
        MeetingExtractionResult.model_validate(
            {
                "meetingId": "meeting-1",
                "tasks": [
                    {
                        "title": "Finish authentication API",
                        "priority": "high",
                        "segmentOrder": 0,
                        "sourceQuote": "I will finish authentication by Friday.",
                        "confidence": 1.5,
                    }
                ],
            }
        )
