"""Strict input and output models for the v0.5 meeting extraction pipeline."""

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TaskPriority(StrEnum):
    """Priorities accepted by both TaskCandidate and the final Task model."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ProjectMemberInput(BaseModel):
    """A project member the extractor may safely suggest as an assignee."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    user_id: str = Field(alias="userId", min_length=1)
    name: str = Field(min_length=1, max_length=100)


class TranscriptSegmentInput(BaseModel):
    """One ordered transcript segment with its permanent Node-side identifier."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    segment_id: str = Field(alias="segmentId", min_length=1)
    order: int = Field(ge=0)
    speaker: str | None = Field(default=None, max_length=100)
    text: str = Field(min_length=1, max_length=500_000)
    start_ms: int | None = Field(default=None, alias="startMs", ge=0)
    end_ms: int | None = Field(default=None, alias="endMs", ge=0)

    @model_validator(mode="after")
    def validate_timestamps(self) -> "TranscriptSegmentInput":
        """Prevent a segment's ending timestamp from preceding its start."""
        if self.start_ms is not None and self.end_ms is not None and self.end_ms < self.start_ms:
            raise ValueError("endMs must be greater than or equal to startMs")
        return self


class MeetingProcessPayload(BaseModel):
    """Typed payload carried by a `meeting.process` or `meeting.reprocess` job."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    meeting_id: str = Field(alias="meetingId", min_length=1)
    title: str = Field(min_length=2, max_length=200)
    meeting_date: date = Field(alias="meetingDate")
    project_members: list[ProjectMemberInput] = Field(alias="projectMembers", default_factory=list)
    segments: list[TranscriptSegmentInput] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_context_identity(self) -> "MeetingProcessPayload":
        """Reject ambiguous members and duplicate segment identifiers/orders."""
        member_ids = [member.user_id for member in self.project_members]
        member_names = [member.name.casefold() for member in self.project_members]
        segment_ids = [segment.segment_id for segment in self.segments]
        segment_orders = [segment.order for segment in self.segments]

        if len(member_ids) != len(set(member_ids)):
            raise ValueError("projectMembers must contain unique userId values")
        if len(member_names) != len(set(member_names)):
            raise ValueError("projectMembers must contain unique names")
        if len(segment_ids) != len(set(segment_ids)):
            raise ValueError("segments must contain unique segmentId values")
        if len(segment_orders) != len(set(segment_orders)):
            raise ValueError("segments must contain unique order values")
        return self


class ExtractedTask(BaseModel):
    """One evidence-backed task proposal returned by the extraction graph."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5_000)
    assignee_name: str | None = Field(default=None, alias="assigneeName", max_length=100)
    due_date: date | None = Field(default=None, alias="dueDate")
    priority: TaskPriority = TaskPriority.MEDIUM
    segment_order: int = Field(alias="segmentOrder", ge=0)
    source_quote: str = Field(alias="sourceQuote", min_length=1, max_length=2_000)
    confidence: float | None = Field(default=None, ge=0, le=1)


class MeetingExtractionResult(BaseModel):
    """Successful structured payload returned to Node for candidate persistence."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    meeting_id: str = Field(alias="meetingId", min_length=1)
    tasks: list[ExtractedTask] = Field(default_factory=list)
