import asyncio

from relay_ai.providers.task_extractor import TaskExtractor
from relay_ai.schemas.jobs import JobEnvelope
from relay_ai.schemas.meetings import ExtractedTask, MeetingProcessPayload, TranscriptSegmentInput
from relay_ai.worker import process_job


class FixedExtractor(TaskExtractor):
    """Returns one deterministic task so worker orchestration can be tested without an API key."""

    async def extract_tasks(
        self,
        payload: MeetingProcessPayload,
        segments: list[TranscriptSegmentInput],
    ) -> list[ExtractedTask]:
        return [
            ExtractedTask(
                title=f"Follow up on {payload.title}",
                segmentOrder=segments[0].order,
                sourceQuote=segments[0].text,
            )
        ]


class FlakyExtractor(FixedExtractor):
    """Fails once so retry behavior can be verified without waiting on a provider."""

    def __init__(self) -> None:
        self.calls = 0

    async def extract_tasks(
        self,
        payload: MeetingProcessPayload,
        segments: list[TranscriptSegmentInput],
    ) -> list[ExtractedTask]:
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("temporary provider failure")
        return await super().extract_tasks(payload, segments)


class FailingExtractor(TaskExtractor):
    """Always fails so terminal retry exhaustion remains contract-valid."""

    def __init__(self) -> None:
        self.calls = 0

    async def extract_tasks(
        self,
        payload: MeetingProcessPayload,
        segments: list[TranscriptSegmentInput],
    ) -> list[ExtractedTask]:
        self.calls += 1
        raise RuntimeError("provider unavailable")


def meeting_job() -> JobEnvelope:
    """Build one TypeScript-compatible meeting job for the worker boundary."""
    return JobEnvelope.model_validate(
        {
            "jobId": "job-1",
            "jobType": "meeting.process",
            "schemaVersion": 1,
            "projectId": "project-1",
            "initiatingUserId": "user-1",
            "resourceId": "meeting-1",
            "createdAt": "2026-08-28T00:00:00Z",
            "payload": {
                "meetingId": "meeting-1",
                "title": "Sprint planning",
                "meetingDate": "2026-08-28",
                "projectMembers": [],
                "segments": [
                    {
                        "segmentId": "segment-1",
                        "order": 0,
                        "text": "I will finish authentication.",
                    }
                ],
            },
        }
    )


def test_process_job_runs_graph_and_builds_success_result() -> None:
    result = asyncio.run(process_job(meeting_job(), FixedExtractor()))

    assert result.status == "succeeded"
    assert result.payload is not None
    assert result.payload["meetingId"] == "meeting-1"
    assert result.payload["tasks"][0]["sourceQuote"] == "I will finish authentication."


def test_process_job_retries_a_temporary_failure() -> None:
    extractor = FlakyExtractor()

    result = asyncio.run(
        process_job(meeting_job(), extractor, max_attempts=2, retry_base_delay_ms=1)
    )

    assert result.status == "succeeded"
    assert extractor.calls == 2


def test_process_job_returns_failure_after_retry_exhaustion() -> None:
    extractor = FailingExtractor()

    result = asyncio.run(
        process_job(meeting_job(), extractor, max_attempts=2, retry_base_delay_ms=1)
    )

    assert result.status == "failed"
    assert result.error is not None
    assert result.error.retryable is True
    assert extractor.calls == 2
