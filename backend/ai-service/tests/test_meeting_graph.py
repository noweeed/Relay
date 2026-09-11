import asyncio
from datetime import date

import pytest

from relay_ai.graphs.meeting_graph import run_meeting_graph
from relay_ai.providers.duplicate_verifier import DuplicateVerification
from relay_ai.providers.mock import StaticEmbeddingProvider, StaticTaskSimilaritySearch
from relay_ai.providers.similarity_search import TaskSimilarityMatch
from relay_ai.schemas.meetings import (
    ExtractedTask,
    MeetingProcessPayload,
    TranscriptSegmentInput,
)


class RecordingExtractor:
    """Predictable extractor that records the normalized graph input for assertions."""

    def __init__(
        self,
        segment_order: int = 0,
        source_quote: str | None = None,
        title: str | None = None,
    ) -> None:
        self.segment_order = segment_order
        self.source_quote = source_quote
        self.title = title
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
                title=self.title or f"Follow up after {payload.title}",
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


def test_graph_embeds_candidates_and_flags_an_open_project_task() -> None:
    payload = meeting_payload().model_copy(update={"open_task_column_ids": ["todo-column"]})
    embedder = StaticEmbeddingProvider([[0.1, 0.2, 0.3]])
    search = StaticTaskSimilaritySearch(
        [
            TaskSimilarityMatch(
                task_id="507f1f77bcf86cd799439011",
                title="Finish authentication API",
                description=None,
                assignee_id=None,
                due_date=date(2026, 8, 25),
                priority="high",
                score=0.91,
            )
        ]
    )

    result = asyncio.run(
        run_meeting_graph(
            payload,
            RecordingExtractor(),
            project_id="507f1f77bcf86cd799439012",
            embedding_provider=embedder,
            similarity_search=search,
        )
    )

    assert result.tasks[0].embedding == [0.1, 0.2, 0.3]
    assert result.tasks[0].duplicate is not None
    assert result.tasks[0].duplicate.existing_task_id == "507f1f77bcf86cd799439011"
    assert result.tasks[0].duplicate.similarity_label == "high"
    assert search.calls[0][1] == ["todo-column"]
    assert search.limits == [10]


def test_graph_rejects_same_template_with_a_different_named_subject() -> None:
    payload = meeting_payload().model_copy(update={"open_task_column_ids": ["todo-column"]})
    search = StaticTaskSimilaritySearch(
        [
            TaskSimilarityMatch(
                task_id="507f1f77bcf86cd799439011",
                title="Set up Supabase",
                description=None,
                assignee_id=None,
                due_date=None,
                priority="medium",
                score=0.97,
            )
        ]
    )

    result = asyncio.run(
        run_meeting_graph(
            payload,
            RecordingExtractor(title="Set up Redis"),
            project_id="507f1f77bcf86cd799439012",
            embedding_provider=StaticEmbeddingProvider([[0.1, 0.2, 0.3]]),
            similarity_search=search,
        )
    )

    assert result.tasks[0].duplicate is None


class RecordingDuplicateVerifier:
    def __init__(self) -> None:
        self.matches: list[TaskSimilarityMatch] = []

    async def verify_duplicates(
        self,
        candidate: ExtractedTask,
        matches: list[TaskSimilarityMatch],
    ) -> list[DuplicateVerification]:
        self.matches = matches
        return [
            DuplicateVerification(matches[0].task_id, "related_but_separate"),
            DuplicateVerification(matches[1].task_id, "same_work"),
        ]


def test_graph_uses_verifier_to_choose_the_first_confirmed_same_work_match() -> None:
    payload = meeting_payload().model_copy(update={"open_task_column_ids": ["todo-column"]})
    matches = [
        TaskSimilarityMatch(
            task_id="507f1f77bcf86cd799439011",
            title="Finish authentication documentation",
            description=None,
            assignee_id=None,
            due_date=None,
            priority="medium",
            score=0.95,
        ),
        TaskSimilarityMatch(
            task_id="507f1f77bcf86cd799439013",
            title="Finish authentication API",
            description=None,
            assignee_id=None,
            due_date=None,
            priority="high",
            score=0.92,
        ),
    ]
    verifier = RecordingDuplicateVerifier()

    result = asyncio.run(
        run_meeting_graph(
            payload,
            RecordingExtractor(title="Finish authentication"),
            project_id="507f1f77bcf86cd799439012",
            embedding_provider=StaticEmbeddingProvider([[0.1, 0.2, 0.3]]),
            similarity_search=StaticTaskSimilaritySearch(matches),
            duplicate_verifier=verifier,
        )
    )

    assert len(verifier.matches) == 2
    assert result.tasks[0].duplicate is not None
    assert result.tasks[0].duplicate.existing_task_id == "507f1f77bcf86cd799439013"
    assert result.tasks[0].duplicate.verification == "same_work"
