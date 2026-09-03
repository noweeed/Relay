import argparse
import asyncio
import logging
import os
import socket
from datetime import UTC, datetime

from relay_ai import __version__
from relay_ai.config import load_settings
from relay_ai.graphs.meeting_graph import run_meeting_graph
from relay_ai.providers.factory import create_task_extractor
from relay_ai.providers.task_extractor import TaskExtractor
from relay_ai.redis_transport import RedisTransport
from relay_ai.schemas.jobs import JobEnvelope, JobError, JobType, ResultEnvelope
from relay_ai.schemas.meetings import MeetingProcessPayload

logger = logging.getLogger(__name__)


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
    *,
    chunk_max_chars: int = 12_000,
    chunk_overlap_segments: int = 1,
    chunk_concurrency: int = 3,
    max_attempts: int = 3,
    retry_base_delay_ms: int = 500,
) -> ResultEnvelope:
    """Run one supported job with bounded exponential retries."""
    for attempt in range(1, max_attempts + 1):
        try:
            if job.job_type not in {JobType.MEETING_PROCESS, JobType.MEETING_REPROCESS}:
                raise ValueError(f"Unsupported AI job type: {job.job_type}")
            payload = MeetingProcessPayload.model_validate(job.payload)
            extraction = await run_meeting_graph(
                payload,
                extractor,
                chunk_max_chars=chunk_max_chars,
                chunk_overlap_segments=chunk_overlap_segments,
                chunk_concurrency=chunk_concurrency,
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
            message="Meeting task extraction failed. You can retry this meeting.",
            retryable=True,
        ),
    )


async def run_worker(*, once: bool) -> int:
    """Continuously consume Redis jobs, run LangGraph, and publish validated results."""
    settings = load_settings()
    transport = RedisTransport.from_settings(settings)
    extractor = create_task_extractor(settings)
    consumer_name = settings.ai_worker_consumer_name or f"{socket.gethostname()}-{os.getpid()}"
    claim_cursor = "0-0"
    try:
        transport.ensure_consumer_group()
        logger.info(
            "Relay AI worker %s is listening on %s", consumer_name, settings.ai_job_stream
        )
        while True:
            claim_cursor, jobs = transport.claim_stale_jobs(consumer_name, claim_cursor)
            if not jobs:
                jobs = transport.read_group_jobs(
                    consumer_name, block_ms=1 if once else 5_000
                )
            for stream_job in jobs:
                if stream_job.envelope is None:
                    transport.publish_dead_letter(
                        stream_id=stream_job.stream_id,
                        error=stream_job.parse_error or "Malformed AI job",
                        raw_envelope=stream_job.raw_envelope,
                    )
                    transport.acknowledge_job(stream_job.stream_id)
                    continue
                result = await process_job(
                    stream_job.envelope,
                    extractor,
                    chunk_max_chars=settings.transcript_chunk_max_chars,
                    chunk_overlap_segments=settings.transcript_chunk_overlap_segments,
                    chunk_concurrency=settings.transcript_chunk_concurrency,
                    max_attempts=settings.ai_job_max_attempts,
                    retry_base_delay_ms=settings.ai_retry_base_delay_ms,
                )
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
