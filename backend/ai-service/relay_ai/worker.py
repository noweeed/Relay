import argparse
import asyncio
import logging
import os
import socket
from datetime import UTC, datetime

from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

from relay_ai import __version__
from relay_ai.config import load_settings
from relay_ai.graphs.command_graph import run_command_graph
from relay_ai.graphs.meeting_graph import run_meeting_graph
from relay_ai.providers.duplicate_verifier import DuplicateVerifier
from relay_ai.providers.embedding import EmbeddingProvider
from relay_ai.providers.factory import (
    create_duplicate_verifier,
    create_embedding_provider,
    create_similarity_search,
    create_task_extractor,
    create_transcription_provider,
)
from relay_ai.providers.similarity_search import TaskSimilaritySearch
from relay_ai.providers.task_extractor import TaskExtractor
from relay_ai.providers.transcription import TranscriptionProvider
from relay_ai.redis_transport import RedisTransport
from relay_ai.schemas.commands import CommandInterpretPayload
from relay_ai.schemas.jobs import JobEnvelope, JobError, JobType, ResultEnvelope
from relay_ai.schemas.meetings import (
    AudioMeetingPayload,
    MeetingProcessPayload,
    TranscriptSegmentInput,
)

logger = logging.getLogger(__name__)
REDIS_RETRY_BASE_SECONDS = 1.0
REDIS_RETRY_MAX_SECONDS = 30.0


def parse_args() -> argparse.Namespace:
    """Parse worker lifecycle flags from the command line."""
    parser = argparse.ArgumentParser(description="Relay Python AI worker")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate that the worker entry point can start, then exit",
    )
    parser.add_argument(
        "--check-transport",
        action="store_true",
        help="Connect to Redis, ping it, then exit",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Process currently available jobs, then exit instead of waiting forever",
    )
    return parser.parse_args()


async def process_job(
    job: JobEnvelope,
    extractor: TaskExtractor,
    transcriber: TranscriptionProvider | None = None,
    embedding_provider: EmbeddingProvider | None = None,
    similarity_search: TaskSimilaritySearch | None = None,
    duplicate_verifier: DuplicateVerifier | None = None,
    *,
    chunk_max_chars: int = 12_000,
    chunk_overlap_segments: int = 1,
    chunk_concurrency: int = 3,
    max_attempts: int = 3,
    retry_base_delay_ms: int = 500,
    duplicate_medium_threshold: float = 0.80,
    duplicate_high_threshold: float = 0.90,
) -> ResultEnvelope:
    """Run one supported job with bounded exponential retries."""
    for attempt in range(1, max_attempts + 1):
        try:
            if job.job_type == JobType.CONTENT_EMBED:
                if embedding_provider is None:
                    raise ValueError("Embedding provider is unavailable")
                resource_id = job.payload.get("resourceId")
                resource_kind = job.payload.get("resourceKind")
                text = job.payload.get("text")
                content_hash = job.payload.get("contentHash")
                if (
                    not isinstance(resource_id, str)
                    or not resource_id
                    or not isinstance(resource_kind, str)
                    or not resource_kind
                    or not isinstance(text, str)
                    or not text
                    or not isinstance(content_hash, str)
                    or not content_hash
                ):
                    raise ValueError("Embedding job payload is invalid")
                if resource_kind not in {"task", "candidate"}:
                    raise ValueError("Embedding resource kind is invalid")
                vectors = await embedding_provider.embed_texts([text])
                if len(vectors) != 1 or not vectors[0]:
                    raise ValueError("Embedding provider returned no vector")
                return ResultEnvelope(
                    jobId=job.job_id,
                    jobType=job.job_type,
                    schemaVersion=1,
                    projectId=job.project_id,
                    resourceId=job.resource_id,
                    correlationId=job.correlation_id,
                    status="succeeded",
                    completedAt=datetime.now(UTC),
                    payload={
                        "resourceId": resource_id,
                        "resourceKind": resource_kind,
                        "contentHash": content_hash,
                        "embedding": vectors[0],
                    },
                )
            if job.job_type == JobType.COMMAND_INTERPRET:
                command = await run_command_graph(
                    CommandInterpretPayload.model_validate(job.payload)
                )
                return ResultEnvelope(
                    jobId=job.job_id,
                    jobType=job.job_type,
                    schemaVersion=1,
                    projectId=job.project_id,
                    resourceId=job.resource_id,
                    correlationId=job.correlation_id,
                    status="succeeded",
                    completedAt=datetime.now(UTC),
                    payload=command.model_dump(mode="json", by_alias=True, exclude_none=True),
                )
            if job.job_type not in {
                JobType.MEETING_PROCESS,
                JobType.MEETING_REPROCESS,
                JobType.MEETING_TRANSCRIBE,
            }:
                raise ValueError(f"Unsupported AI job type: {job.job_type}")
            transcript = None
            if job.job_type == JobType.MEETING_TRANSCRIBE:
                if transcriber is None:
                    raise ValueError("Audio transcription provider is unavailable")
                audio_payload = AudioMeetingPayload.model_validate(job.payload)
                transcript = await transcriber.transcribe(audio_payload)
                payload = MeetingProcessPayload(
                    meetingId=audio_payload.meeting_id,
                    title=audio_payload.title,
                    meetingDate=audio_payload.meeting_date,
                    projectMembers=audio_payload.project_members,
                    openTaskColumnIds=audio_payload.open_task_column_ids,
                    segments=[
                        TranscriptSegmentInput(
                            segmentId=f"audio:{audio_payload.meeting_id}:{segment.order}",
                            order=segment.order,
                            speaker=segment.speaker,
                            text=segment.text,
                            startMs=segment.start_ms,
                            endMs=segment.end_ms,
                        )
                        for segment in transcript
                    ],
                )
            else:
                payload = MeetingProcessPayload.model_validate(job.payload)
            extraction = await run_meeting_graph(
                payload,
                extractor,
                project_id=job.project_id,
                embedding_provider=embedding_provider,
                similarity_search=similarity_search,
                duplicate_verifier=duplicate_verifier,
                duplicate_medium_threshold=duplicate_medium_threshold,
                duplicate_high_threshold=duplicate_high_threshold,
                chunk_max_chars=chunk_max_chars,
                chunk_overlap_segments=chunk_overlap_segments,
                chunk_concurrency=chunk_concurrency,
            )
            if transcript is not None:
                extraction.transcript = transcript
            return ResultEnvelope(
                jobId=job.job_id,
                jobType=job.job_type,
                schemaVersion=1,
                projectId=job.project_id,
                resourceId=job.resource_id,
                correlationId=job.correlation_id,
                status="succeeded",
                completedAt=datetime.now(UTC),
                payload=extraction.model_dump(mode="json", by_alias=True, exclude_none=True),
            )
        except Exception:
            if attempt < max_attempts:
                delay_ms = retry_base_delay_ms * (2 ** (attempt - 1))
                logger.warning(
                    "AI job %s attempt %s/%s failed; retrying in %sms",
                    job.job_id,
                    attempt,
                    max_attempts,
                    delay_ms,
                    exc_info=True,
                )
                await asyncio.sleep(delay_ms / 1_000)
                continue
            # Provider details stay in worker logs; the user-facing result remains sanitized.
            logger.exception("AI job %s failed after %s attempts", job.job_id, max_attempts)

    return ResultEnvelope(
        jobId=job.job_id,
        jobType=job.job_type,
        schemaVersion=1,
        projectId=job.project_id,
        resourceId=job.resource_id,
        correlationId=job.correlation_id,
        status="failed",
        completedAt=datetime.now(UTC),
        error=JobError(
            code="AI_PROCESSING_FAILED",
            message=(
                "Command interpretation failed. You can retry the command."
                if job.job_type == JobType.COMMAND_INTERPRET
                else "Embedding refresh failed and will retry after the next edit."
                if job.job_type == JobType.CONTENT_EMBED
                else "Meeting task extraction failed. You can retry this meeting."
            ),
            retryable=True,
        ),
    )


async def run_worker(*, once: bool) -> int:
    """Continuously consume Redis jobs, run LangGraph, and publish validated results."""
    settings = load_settings()
    transport = RedisTransport.from_settings(settings)
    extractor = create_task_extractor(settings)
    transcriber = create_transcription_provider(settings)
    embedding_provider = create_embedding_provider(settings)
    similarity_search = create_similarity_search(settings)
    duplicate_verifier = create_duplicate_verifier(settings)
    consumer_name = settings.ai_worker_consumer_name or f"{socket.gethostname()}-{os.getpid()}"
    claim_cursor = "0-0"
    redis_retry_seconds = REDIS_RETRY_BASE_SECONDS
    try:
        while True:
            try:
                transport.ensure_consumer_group()
                break
            except (RedisConnectionError, RedisTimeoutError) as error:
                logger.warning(
                    "Redis setup failed (%s); reconnecting in %.1fs",
                    error,
                    redis_retry_seconds,
                )
                transport.reconnect()
                await asyncio.sleep(redis_retry_seconds)
                redis_retry_seconds = min(redis_retry_seconds * 2, REDIS_RETRY_MAX_SECONDS)
        logger.info("Relay AI worker %s is listening on %s", consumer_name, settings.ai_job_stream)
        redis_retry_seconds = REDIS_RETRY_BASE_SECONDS
        while True:
            try:
                claim_cursor, jobs = transport.claim_stale_jobs(
                    consumer_name, claim_cursor, count=1
                )
                if not jobs:
                    jobs = transport.read_group_jobs(
                        consumer_name, block_ms=1 if once else 5_000, count=1
                    )
                redis_retry_seconds = REDIS_RETRY_BASE_SECONDS
            except (RedisConnectionError, RedisTimeoutError) as error:
                logger.warning(
                    "Redis read failed (%s); reconnecting in %.1fs",
                    error,
                    redis_retry_seconds,
                )
                transport.reconnect()
                await asyncio.sleep(redis_retry_seconds)
                redis_retry_seconds = min(redis_retry_seconds * 2, REDIS_RETRY_MAX_SECONDS)
                continue
            for stream_job in jobs:
                if stream_job.envelope is None:
                    transport.publish_dead_letter(
                        stream_id=stream_job.stream_id,
                        error=stream_job.parse_error or "Malformed AI job",
                        raw_envelope=stream_job.raw_envelope,
                    )
                    transport.acknowledge_job(stream_job.stream_id)
                    continue
                stop_lease = asyncio.Event()

                async def renew_lease(
                    lease_stop: asyncio.Event = stop_lease,
                    stream_id: str = stream_job.stream_id,
                ) -> None:
                    interval = max(1.0, settings.ai_pending_idle_ms / 3_000)
                    while not lease_stop.is_set():
                        try:
                            await asyncio.wait_for(lease_stop.wait(), timeout=interval)
                        except TimeoutError:
                            await asyncio.to_thread(
                                transport.renew_job,
                                stream_id,
                                consumer_name,
                            )

                lease_task = asyncio.create_task(renew_lease())
                try:
                    result = await process_job(
                        stream_job.envelope,
                        extractor,
                        transcriber,
                        embedding_provider,
                        similarity_search,
                        duplicate_verifier,
                        chunk_max_chars=settings.transcript_chunk_max_chars,
                        chunk_overlap_segments=settings.transcript_chunk_overlap_segments,
                        chunk_concurrency=settings.transcript_chunk_concurrency,
                        max_attempts=settings.ai_job_max_attempts,
                        retry_base_delay_ms=settings.ai_retry_base_delay_ms,
                        duplicate_medium_threshold=settings.duplicate_medium_threshold,
                        duplicate_high_threshold=settings.duplicate_high_threshold,
                    )
                finally:
                    stop_lease.set()
                    await lease_task
                transport.publish_result(result)
                if result.status == "failed":
                    transport.publish_dead_letter(
                        stream_id=stream_job.stream_id,
                        error=result.error.message if result.error else "AI processing failed",
                        raw_envelope=stream_job.raw_envelope,
                        job_id=stream_job.envelope.job_id,
                    )
                # Ack only after result and optional dead letter are safely published.
                transport.acknowledge_job(stream_job.stream_id)
            if once:
                return 0
    finally:
        close = getattr(extractor, "close", None)
        if callable(close):
            await close()
        close_transcriber = getattr(transcriber, "close", None)
        if callable(close_transcriber):
            await close_transcriber()
        close_embedding = getattr(embedding_provider, "close", None)
        if callable(close_embedding):
            await close_embedding()
        close_search = getattr(similarity_search, "close", None)
        if callable(close_search):
            close_search()
        close_verifier = getattr(duplicate_verifier, "close", None)
        if callable(close_verifier):
            await close_verifier()
        transport.close()


def main() -> int:
    """Run startup checks or launch the Redis-backed extraction worker."""
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.check:
        logger.info("Relay AI worker %s entry point is ready", __version__)
        return 0

    if args.check_transport:
        transport = RedisTransport.from_settings(load_settings())
        try:
            if not transport.ping():
                logger.error("Redis transport ping returned false")
                return 1
            logger.info("Relay AI worker Redis transport is ready")
            return 0
        finally:
            transport.close()

    try:
        return asyncio.run(run_worker(once=args.once))
    except KeyboardInterrupt:
        logger.info("Relay AI worker stopped")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
