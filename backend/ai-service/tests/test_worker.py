import asyncio
from types import SimpleNamespace

import pytest
from redis.exceptions import TimeoutError as RedisTimeoutError

from relay_ai import worker as worker_module
from relay_ai.providers.mock import StaticEmbeddingProvider
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


def test_process_job_refreshes_content_embedding() -> None:
    job = JobEnvelope.model_validate(
        {
            "jobId": "embed-1",
            "jobType": "content.embed",
            "schemaVersion": 1,
            "projectId": "project-1",
            "initiatingUserId": "user-1",
            "resourceId": "0123456789abcdef01234567",
            "createdAt": "2026-09-05T00:00:00Z",
            "payload": {
                "resourceId": "0123456789abcdef01234567",
                "resourceKind": "task",
                "text": "Current task text",
                "contentHash": "a" * 64,
            },
        }
    )

    result = asyncio.run(
        process_job(
            job,
            FixedExtractor(),
            embedding_provider=StaticEmbeddingProvider([[0.1, 0.2]]),
        )
    )

    assert result.status == "succeeded"
    assert result.payload is not None
    assert result.payload["embedding"] == [0.1, 0.2]


def test_worker_reconnects_after_a_transient_redis_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FlakyTransport:
        def __init__(self) -> None:
            self.claim_calls = 0
            self.reconnect_calls = 0

        def ensure_consumer_group(self) -> None:
            return None

        def claim_stale_jobs(
            self, _consumer_name: str, _cursor: str, *, count: int
        ) -> tuple[str, list[object]]:
            assert count == 1
            self.claim_calls += 1
            if self.claim_calls == 1:
                raise RedisTimeoutError("temporary read timeout")
            return "0-0", []

        def read_group_jobs(
            self, _consumer_name: str, *, block_ms: int, count: int
        ) -> list[object]:
            assert block_ms == 1
            assert count == 1
            return []

        def reconnect(self) -> None:
            self.reconnect_calls += 1

        def close(self) -> None:
            return None

    transport = FlakyTransport()
    settings = SimpleNamespace(
        ai_worker_consumer_name="worker-1",
        ai_job_stream="relay:ai:jobs",
        ai_pending_idle_ms=30_000,
        transcript_chunk_max_chars=12_000,
        transcript_chunk_overlap_segments=1,
        transcript_chunk_concurrency=1,
        ai_job_max_attempts=3,
        ai_retry_base_delay_ms=500,
        duplicate_medium_threshold=0.80,
        duplicate_high_threshold=0.90,
    )

    async def no_wait(_seconds: float) -> None:
        return None

    monkeypatch.setattr(worker_module, "load_settings", lambda: settings)
    monkeypatch.setattr(
        worker_module.RedisTransport,
        "from_settings",
        lambda _settings: transport,
    )
    monkeypatch.setattr(worker_module, "create_task_extractor", lambda _settings: FixedExtractor())
    monkeypatch.setattr(worker_module, "create_transcription_provider", lambda _settings: None)
    monkeypatch.setattr(worker_module, "create_embedding_provider", lambda _settings: None)
    monkeypatch.setattr(worker_module, "create_similarity_search", lambda _settings: None)
    monkeypatch.setattr(worker_module, "create_duplicate_verifier", lambda _settings: None)
    monkeypatch.setattr(worker_module.asyncio, "sleep", no_wait)

    result = asyncio.run(worker_module.run_worker(once=True))

    assert result == 0
    assert transport.claim_calls == 2
    assert transport.reconnect_calls == 1
