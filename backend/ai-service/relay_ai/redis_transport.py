"""Validated Redis Streams transport shared by the Relay AI worker."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import cast

from pydantic import ValidationError
from redis import Redis
from redis.exceptions import ResponseError
from redis.typing import EncodableT

from relay_ai.config import Settings
from relay_ai.schemas.jobs import JobEnvelope, ResultEnvelope

ENVELOPE_FIELD = "envelope"
StreamReadResponse = list[tuple[str, list[tuple[str, dict[str, str]]]]]


@dataclass(frozen=True)
class StreamJob:
    """A validated job paired with the Redis ID used as the next read cursor."""

    stream_id: str
    envelope: JobEnvelope


@dataclass(frozen=True)
class StreamDelivery:
    """A consumer-group delivery, valid or malformed, that must eventually be acknowledged."""

    stream_id: str
    raw_envelope: str | None
    envelope: JobEnvelope | None
    parse_error: str | None = None


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
        response = cast(
            StreamReadResponse,
            self._client.xread(
                {self._settings.ai_job_stream: last_id},
                block=block_ms,
                count=count,
            ),
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

    def ensure_consumer_group(self) -> None:
        """Create the durable worker group and stream if this is the first worker."""
        try:
            self._client.xgroup_create(
                self._settings.ai_job_stream,
                self._settings.ai_worker_consumer_group,
                id="0",
                mkstream=True,
            )
        except ResponseError as error:
            if "BUSYGROUP" not in str(error):
                raise

    def _deliveries(self, response: StreamReadResponse) -> list[StreamDelivery]:
        deliveries: list[StreamDelivery] = []
        for _stream_name, messages in response:
            for stream_id, fields in messages:
                raw_envelope = fields.get(ENVELOPE_FIELD)
                if not isinstance(raw_envelope, str):
                    deliveries.append(
                        StreamDelivery(str(stream_id), None, None, "Missing string envelope field")
                    )
                    continue
                try:
                    envelope = JobEnvelope.model_validate_json(raw_envelope)
                except ValidationError as error:
                    deliveries.append(
                        StreamDelivery(str(stream_id), raw_envelope, None, str(error)[:2_000])
                    )
                    continue
                deliveries.append(StreamDelivery(str(stream_id), raw_envelope, envelope))
        return deliveries

    def read_group_jobs(
        self, consumer_name: str, *, block_ms: int = 5_000, count: int = 10
    ) -> list[StreamDelivery]:
        """Read new jobs into this consumer's pending list."""
        response = cast(
            StreamReadResponse,
            self._client.xreadgroup(
                self._settings.ai_worker_consumer_group,
                consumer_name,
                {self._settings.ai_job_stream: ">"},
                block=block_ms,
                count=count,
            ),
        )
        return self._deliveries(response)

    def claim_stale_jobs(
        self, consumer_name: str, start_id: str = "0-0", *, count: int = 10
    ) -> tuple[str, list[StreamDelivery]]:
        """Take over deliveries abandoned by a stopped worker."""
        response = self._client.xautoclaim(
            self._settings.ai_job_stream,
            self._settings.ai_worker_consumer_group,
            consumer_name,
            self._settings.ai_pending_idle_ms,
            start_id,
            count=count,
        )
        next_id = str(response[0])
        messages = response[1]
        wrapped = [(self._settings.ai_job_stream, messages)] if messages else []
        return next_id, self._deliveries(cast(StreamReadResponse, wrapped))

    def acknowledge_job(self, stream_id: str) -> None:
        """Remove one fully handled delivery from the group's pending list."""
        self._client.xack(
            self._settings.ai_job_stream,
            self._settings.ai_worker_consumer_group,
            stream_id,
        )

    def publish_dead_letter(
        self,
        *,
        stream_id: str,
        error: str,
        raw_envelope: str | None,
        job_id: str | None = None,
    ) -> str:
        """Preserve malformed or terminally failed work for human diagnosis."""
        payload: dict[EncodableT, EncodableT] = {
            "sourceStream": self._settings.ai_job_stream,
            "sourceId": stream_id,
            "error": error[:2_000],
            "failedAt": datetime.now(UTC).isoformat(),
        }
        if raw_envelope is not None:
            payload[ENVELOPE_FIELD] = raw_envelope
        if job_id is not None:
            payload["jobId"] = job_id
        return str(self._client.xadd(self._settings.ai_dead_letter_stream, payload))

    def publish_result(self, result: ResultEnvelope) -> str:
        """Validate and append a Python result using the cross-runtime JSON contract."""
        payload: dict[EncodableT, EncodableT] = {
            ENVELOPE_FIELD: result.model_dump_json(by_alias=True, exclude_none=True)
        }
        stream_id = self._client.xadd(self._settings.ai_result_stream, payload)
        return str(stream_id)

    def close(self) -> None:
        """Release the worker's Redis connection."""
        self._client.close()
