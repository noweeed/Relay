from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from relay_ai.schemas.jobs import JobEnvelope, ResultEnvelope


def test_job_envelope_accepts_v1_contract() -> None:
    job = JobEnvelope.model_validate(
        {
            "jobId": "job-1",
            "jobType": "meeting.process",
            "schemaVersion": 1,
            "projectId": "project-1",
            "initiatingUserId": "user-1",
            "createdAt": datetime.now(UTC).isoformat(),
            "payload": {"meetingId": "meeting-1"},
        }
    )

    assert job.job_id == "job-1"


def test_failed_result_requires_error() -> None:
    with pytest.raises(ValidationError):
        ResultEnvelope.model_validate(
            {
                "jobId": "job-1",
                "jobType": "meeting.process",
                "schemaVersion": 1,
                "projectId": "project-1",
                "status": "failed",
                "completedAt": datetime.now(UTC).isoformat(),
            }
        )
