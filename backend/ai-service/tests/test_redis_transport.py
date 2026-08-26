from datetime import UTC, datetime
from typing import Any

import pytest

from relay_ai.config import Settings
from relay_ai.redis_transport import RedisTransport
from relay_ai.schemas.jobs import ResultEnvelope


class FakeRedis:
    """Small in-memory Redis substitute for transport contract tests."""

    def __init__(self) -> None:
        self.read_response: list[Any] = []
        self.added: list[tuple[str, dict[str, Any]]] = []

    def ping(self) -> bool:
        return True

    def xread(self, streams: dict[str, str], **options: Any) -> list[Any]:
        assert streams == {"relay:ai:jobs": "0-0"}
        assert options == {"block": 1, "count": 10}
        return self.read_response

    def xadd(self, stream: str, fields: dict[str, Any]) -> str:
        self.added.append((stream, fields))
        return "1710000000001-0"

    def close(self) -> None:
        return None


def settings() -> Settings:
    """Build isolated worker settings without reading a developer's environment file."""
    return Settings(REDIS_URL="redis://localhost:6379")  # type: ignore[call-arg]


def test_reads_and_validates_job_envelopes() -> None:
    fake = FakeRedis()
    fake.read_response = [
        (
            "relay:ai:jobs",
            [
                (
                    "1710000000000-0",
                    {
                        "envelope": json_job(),
                    },
                )
            ],
        )
    ]
    transport = RedisTransport(fake, settings())  # type: ignore[arg-type]

    jobs = transport.read_jobs("0-0", block_ms=1)

    assert jobs[0].stream_id == "1710000000000-0"
    assert jobs[0].envelope.resource_id == "meeting-1"


def test_rejects_malformed_job_json() -> None:
    fake = FakeRedis()
    fake.read_response = [("relay:ai:jobs", [("bad-1", {"envelope": "not-json"})])]
    transport = RedisTransport(fake, settings())  # type: ignore[arg-type]

    with pytest.raises(ValueError):
        transport.read_jobs("0-0", block_ms=1)


def test_publishes_result_envelope() -> None:
    fake = FakeRedis()
    transport = RedisTransport(fake, settings())  # type: ignore[arg-type]
    result = ResultEnvelope.model_validate(
        {
            "jobId": "job-1",
            "jobType": "meeting.process",
            "schemaVersion": 1,
            "projectId": "project-1",
            "resourceId": "meeting-1",
            "status": "succeeded",
            "completedAt": datetime.now(UTC).isoformat(),
            "payload": {"meetingId": "meeting-1", "tasks": []},
        }
    )

    stream_id = transport.publish_result(result)

    assert stream_id == "1710000000001-0"
    assert fake.added[0][0] == "relay:ai:results"
    assert '"jobId":"job-1"' in fake.added[0][1]["envelope"]


def json_job() -> str:
    """Return one valid TypeScript-compatible job envelope as JSON."""
    return (
        '{"jobId":"job-1","jobType":"meeting.process","schemaVersion":1,'
        '"projectId":"project-1","initiatingUserId":"user-1",'
        '"resourceId":"meeting-1","createdAt":"2026-08-26T00:00:00Z",'
        '"payload":{"meetingId":"meeting-1"}}'
    )
