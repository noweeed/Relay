from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class JobType(StrEnum):
    MEETING_PROCESS = "meeting.process"
    MEETING_REPROCESS = "meeting.reprocess"
    COMMAND_INTERPRET = "command.interpret"


class JobEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(alias="jobId", min_length=1)
    job_type: JobType = Field(alias="jobType")
    schema_version: Literal[1] = Field(alias="schemaVersion")
    project_id: str = Field(alias="projectId", min_length=1)
    initiating_user_id: str = Field(alias="initiatingUserId", min_length=1)
    resource_id: str | None = Field(default=None, alias="resourceId", min_length=1)
    correlation_id: str | None = Field(default=None, alias="correlationId", min_length=1)
    created_at: datetime = Field(alias="createdAt")
    payload: dict[str, Any]


class JobError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    retryable: bool


class ResultEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(alias="jobId", min_length=1)
    job_type: JobType = Field(alias="jobType")
    schema_version: Literal[1] = Field(alias="schemaVersion")
    project_id: str = Field(alias="projectId", min_length=1)
    resource_id: str | None = Field(default=None, alias="resourceId", min_length=1)
    correlation_id: str | None = Field(default=None, alias="correlationId", min_length=1)
    status: Literal["succeeded", "failed"]
    completed_at: datetime = Field(alias="completedAt")
    payload: dict[str, Any] | None = None
    error: JobError | None = None

    @model_validator(mode="after")
    def validate_outcome(self) -> "ResultEnvelope":
        """Require a payload for success and a structured error for failure."""
        if self.status == "succeeded" and self.payload is None:
            raise ValueError("successful results require payload")
        if self.status == "failed" and self.error is None:
            raise ValueError("failed results require error")
        return self
