"""Validated Redis Streams transport shared by the Relay AI worker."""

from dataclasses import dataclass
from typing import Any

from redis import Redis

from relay_ai.config import Settings
from relay_ai.schemas.jobs import JobEnvelope, ResultEnvelope

ENVELOPE_FIELD = "envelope"


@dataclass(frozen=True)
class StreamJob:
    """A validated job paired with the Redis ID used as the next read cursor."""

    stream_id: str
    envelope: JobEnvelope


class RedisTransport:
    """Reads Node jobs and publishes Python results using one JSON envelope field."""

    def __init__(self, client: Redis, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    @classmethod
    def from_settings(cls, settings: Settings) -> "RedisTransport":
        """Create a decoded Redis connection from validated worker settings."""
        client = Redis.from_url(settings.redis_url, decode_responses=True)
        return cls(client, settings)

    def ping(self) -> bool:
        """Verify that the configured Redis server is reachable."""
        return bool(self._client.ping())

    def read_jobs(self, last_id: str, *, block_ms: int = 5_000, count: int = 10) -> list[StreamJob]:
        """Read and validate jobs after a cursor without acknowledging or persisting them."""
        response = self._client.xread(
            {self._settings.ai_job_stream: last_id},
            block=block_ms,
            count=count,
        )
        jobs: list[StreamJob] = []
        for _stream_name, messages in response:
            for stream_id, fields in messages:
                raw_envelope = fields.get(ENVELOPE_FIELD)
                if not isinstance(raw_envelope, str):
                    raise TypeError(f"AI job {stream_id} is missing its string envelope field")
                jobs.append(
                    StreamJob(
                        stream_id=str(stream_id),
                        envelope=JobEnvelope.model_validate_json(raw_envelope),
                    )
                )
        return jobs

    def publish_result(self, result: ResultEnvelope) -> str:
        """Validate and append a Python result using the cross-runtime JSON contract."""
        payload: dict[str, Any] = {
            ENVELOPE_FIELD: result.model_dump_json(by_alias=True, exclude_none=True)
        }
        stream_id = self._client.xadd(self._settings.ai_result_stream, payload)
        return str(stream_id)

    def close(self) -> None:
        """Release the worker's Redis connection."""
        self._client.close()
