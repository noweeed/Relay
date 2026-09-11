import asyncio
import json
from pathlib import Path

from relay_ai.providers.mock import StaticTaskExtractor, StaticTranscriptionProvider
from relay_ai.schemas.commands import CommandInterpretPayload, CommandInterpretResult
from relay_ai.schemas.jobs import JobEnvelope, ResultEnvelope
from relay_ai.schemas.meetings import (
    AudioMeetingPayload,
    ExtractedTask,
    MeetingExtractionResult,
    MeetingProcessPayload,
)
from relay_ai.worker import process_job

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict[str, object]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_job_and_result_fixtures_match_python_contracts() -> None:
    job = JobEnvelope.model_validate(load_fixture("meeting_process_job.json"))
    result = ResultEnvelope.model_validate(load_fixture("meeting_process_result.json"))
    payload = MeetingProcessPayload.model_validate(job.payload)
    extraction = MeetingExtractionResult.model_validate(result.payload)

    assert payload.meeting_id == result.resource_id
    assert extraction.tasks[0].source_quote in payload.segments[0].text


def test_static_provider_drives_the_worker_without_network_access() -> None:
    job = JobEnvelope.model_validate(load_fixture("meeting_process_job.json"))
    extraction = MeetingExtractionResult.model_validate(
        load_fixture("meeting_process_result.json")["payload"]
    )
    provider = StaticTaskExtractor(
        [ExtractedTask.model_validate(task.model_dump(by_alias=True)) for task in extraction.tasks]
    )

    result = asyncio.run(process_job(job, provider))

    assert result.status == "succeeded"
    assert result.payload == extraction.model_dump(by_alias=True, mode="json", exclude_none=True)
    assert len(provider.calls) == 1


def test_audio_job_and_result_fixtures_match_python_contracts() -> None:
    job = JobEnvelope.model_validate(load_fixture("meeting_transcribe_job.json"))
    expected = ResultEnvelope.model_validate(load_fixture("meeting_transcribe_result.json"))
    payload = AudioMeetingPayload.model_validate(job.payload)
    extraction = MeetingExtractionResult.model_validate(expected.payload)
    extractor = StaticTaskExtractor(extraction.tasks)
    transcriber = StaticTranscriptionProvider(extraction.transcript or [])

    result = asyncio.run(process_job(job, extractor, transcriber))

    assert payload.audio.mime_type == "audio/wav"
    assert result.status == "succeeded"
    assert result.payload == extraction.model_dump(by_alias=True, mode="json", exclude_none=True)
    assert len(transcriber.calls) == 1


def test_command_job_and_result_fixtures_match_python_contracts() -> None:
    job = JobEnvelope.model_validate(load_fixture("command_interpret_job.json"))
    expected = ResultEnvelope.model_validate(load_fixture("command_interpret_result.json"))
    payload = CommandInterpretPayload.model_validate(job.payload)
    result = CommandInterpretResult.model_validate(expected.payload)

    assert payload.command_id == result.command_id
    assert result.requires_confirmation is True
