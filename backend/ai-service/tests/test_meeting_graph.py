import asyncio

import pytest

from relay_ai.graphs.meeting_graph import run_meeting_graph
from relay_ai.schemas.meetings import (
    ExtractedTask,
    MeetingProcessPayload,
    TranscriptSegmentInput,
)


class RecordingExtractor:
    """Predictable extractor that records the normalized graph input for assertions."""

    def __init__(self, segment_order: int = 0, source_quote: str | None = None) -> None:
        self.segment_order = segment_order
        self.source_quote = source_quote
        self.segments: list[TranscriptSegmentInput] = []
        self.calls: list[list[TranscriptSegmentInput]] = []

    async def extract_tasks(
        self,
        payload: MeetingProcessPayload,
        segments: list[TranscriptSegmentInput],
    ) -> list[ExtractedTask]:
        """Return one strict candidate without performing a model call."""
        self.segments = segments
        self.calls.append(segments)
        return [
            ExtractedTask(
                title=f"Follow up after {payload.title}",
                segmentOrder=self.segment_order,
                sourceQuote=self.source_quote or segments[0].text,
            )
        ]


def meeting_payload() -> MeetingProcessPayload:
    """Build the smallest valid input accepted by the compiled meeting graph."""
    return MeetingProcessPayload.model_validate(
        {
            "meetingId": "meeting-1",
            "title": "Sprint planning",
            "meetingDate": "2026-08-28",
            "segments": [
                {
                    "segmentId": "segment-1",
                    "order": 0,
                    "speaker": " Naveed ",
                    "text": "  I will finish authentication.  ",
                }
            ],
        }
    )


def test_graph_normalizes_extracts_and_prepares_review_result() -> None:
    extractor = RecordingExtractor()

    result = asyncio.run(run_meeting_graph(meeting_payload(), extractor))

    assert result.meeting_id == "meeting-1"
    assert result.tasks[0].title == "Follow up after Sprint planning"
    assert extractor.segments[0].text == "I will finish authentication."
    assert extractor.segments[0].segment_id == "segment-1"


def test_graph_rejects_candidates_without_source_segment() -> None:
    extractor = RecordingExtractor(segment_order=99)

    with pytest.raises(ValueError, match="unknown segment orders"):
        asyncio.run(run_meeting_graph(meeting_payload(), extractor))


def test_graph_rejects_an_invented_source_quote() -> None:
    extractor = RecordingExtractor(source_quote="This was never said.")

    with pytest.raises(ValueError, match="non-verbatim source quotes"):
        asyncio.run(run_meeting_graph(meeting_payload(), extractor))


def test_graph_chunks_long_transcripts_and_reconciles_overlap_results() -> None:
    payload = MeetingProcessPayload.model_validate(
        {
            "meetingId": "meeting-1",
            "title": "Sprint planning",
            "meetingDate": "2026-08-28",
            "segments": [
                {
                    "segmentId": f"segment-{order}",
                    "order": order,
                    "text": f"Action {order} " + ("x" * 40),
                }
                for order in range(3)
            ],
        }
    )
    extractor = RecordingExtractor(segment_order=1, source_quote=payload.segments[1].text)

    result = asyncio.run(
        run_meeting_graph(
            payload,
            extractor,
            chunk_max_chars=110,
            chunk_overlap_segments=1,
            chunk_concurrency=2,
        )
    )

    assert len(extractor.calls) == 2
    assert [segment.order for segment in extractor.calls[0]] == [0, 1]
    assert [segment.order for segment in extractor.calls[1]] == [1, 2]
    assert len(result.tasks) == 1
