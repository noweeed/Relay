import asyncio
import json
from pathlib import Path

from relay_ai.providers.mock import StaticTaskExtractor
from relay_ai.schemas.jobs import JobEnvelope, ResultEnvelope
from relay_ai.schemas.meetings import ExtractedTask, MeetingExtractionResult, MeetingProcessPayload
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
    assert result.payload == extraction.model_dump(by_alias=True, mode="json")
    assert len(provider.calls) == 1
