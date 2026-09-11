import asyncio

from relay_ai.graphs.command_graph import run_command_graph
from relay_ai.schemas.commands import CommandInterpretPayload


def payload(text: str, *, duplicate: bool = False) -> CommandInterpretPayload:
    tasks = [{"id": "task-1", "title": "Finalize authentication flow", "columnId": "todo"}]
    if duplicate:
        tasks.append({"id": "task-2", "title": "Authentication tests", "columnId": "todo"})
    return CommandInterpretPayload.model_validate(
        {
            "commandId": "command-1",
            "text": text,
            "tasks": tasks,
            "columns": [
                {"id": "todo", "name": "Todo", "category": "todo"},
                {
                    "id": "in-progress",
                    "name": "In Progress",
                    "category": "in_progress",
                },
                {"id": "done", "name": "Done", "category": "done"},
            ],
            "members": [
                {"id": "user-1", "name": "Abdullah Khan"},
                {"id": "user-2", "name": "Ahmed"},
            ],
        }
    )


def test_move_command_returns_confirmation_preview() -> None:
    result = asyncio.run(run_command_graph(payload("Move authentication to done")))
    assert result.status == "resolved"
    assert result.intent == "update_task_status"
    assert result.task_id == "task-1"
    assert result.target_column_id == "done"
    assert result.requires_confirmation is True


def test_ambiguous_task_reference_returns_candidates() -> None:
    result = asyncio.run(run_command_graph(payload("Move authentication to done", duplicate=True)))
    assert result.status == "ambiguous"
    assert [candidate.id for candidate in result.candidate_matches] == ["task-1", "task-2"]


def test_overdue_query_is_read_only() -> None:
    result = asyncio.run(run_command_graph(payload("What tasks are overdue?")))
    assert result.intent == "list_overdue_tasks"
    assert result.requires_confirmation is False


def test_compound_move_and_assign_command_keeps_both_actions() -> None:
    result = asyncio.run(
        run_command_graph(
            payload(
                "Move finalize authentication flow to in progress and add assignee Ahmed as well"
            )
        )
    )
    assert result.intent == "update_task_status"
    assert result.task_id == "task-1"
    assert result.target_column_id == "in-progress"
    assert result.target_assignee_id == "user-2"
    assert "assign it to Ahmed" in result.preview


def test_add_assignee_wording_and_common_typo_are_supported() -> None:
    result = asyncio.run(
        run_command_graph(payload("Add Ahmed as assgnee in finalize authentication flow"))
    )
    assert result.intent == "assign_task"
    assert result.task_id == "task-1"
    assert result.target_assignee_id == "user-2"
