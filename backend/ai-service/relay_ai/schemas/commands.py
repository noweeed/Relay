from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CommandTaskContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    column_id: str = Field(alias="columnId", min_length=1)
    assignee_id: str | None = Field(default=None, alias="assigneeId")


class CommandColumnContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=40)
    category: Literal["todo", "in_progress", "done"]


class CommandMemberContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=80)


class CommandInterpretPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    command_id: str = Field(alias="commandId", min_length=1)
    text: str = Field(min_length=1, max_length=1_000)
    tasks: list[CommandTaskContext]
    columns: list[CommandColumnContext]
    members: list[CommandMemberContext]


class CommandCandidateMatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    label: str = Field(min_length=1, max_length=200)


class CommandInterpretResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    command_id: str = Field(alias="commandId", min_length=1)
    status: Literal["resolved", "ambiguous", "unsupported"]
    intent: Literal["list_overdue_tasks", "update_task_status", "assign_task", "unknown"]
    task_id: str | None = Field(default=None, alias="taskId")
    target_column_id: str | None = Field(default=None, alias="targetColumnId")
    target_assignee_id: str | None = Field(default=None, alias="targetAssigneeId")
    requires_confirmation: bool = Field(alias="requiresConfirmation")
    preview: str = Field(min_length=1, max_length=1_000)
    candidate_matches: list[CommandCandidateMatch] = Field(
        default_factory=list, alias="candidateMatches"
    )

    @model_validator(mode="after")
    def validate_resolved_mutation(self) -> "CommandInterpretResult":
        if (
            self.status == "resolved"
            and self.intent == "update_task_status"
            and (not self.task_id or not self.target_column_id or not self.requires_confirmation)
        ):
            raise ValueError("resolved status updates require a task, column, and confirmation")
        if (
            self.status == "resolved"
            and self.intent == "assign_task"
            and (not self.task_id or not self.target_assignee_id or not self.requires_confirmation)
        ):
            raise ValueError("resolved assignments require a task, assignee, and confirmation")
        if self.intent == "list_overdue_tasks" and self.requires_confirmation:
            raise ValueError("read-only commands cannot require confirmation")
        return self
