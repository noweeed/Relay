import re
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from relay_ai.schemas.commands import (
    CommandCandidateMatch,
    CommandColumnContext,
    CommandInterpretPayload,
    CommandInterpretResult,
    CommandMemberContext,
    CommandTaskContext,
)

CommandIntent = Literal["list_overdue_tasks", "update_task_status", "assign_task", "unknown"]
ASSIGNEE_WORD = r"ass(?:i)?gnee"


class CommandGraphState(TypedDict, total=False):
    payload: CommandInterpretPayload
    intent: CommandIntent
    entity_text: str
    target_column: CommandColumnContext
    target_member: CommandMemberContext
    task_matches: list[CommandTaskContext]
    result: CommandInterpretResult


def _normalize(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.casefold()))


def _matches(label: str, query: str) -> bool:
    normalized_label = _normalize(label)
    normalized_query = _normalize(query)
    if not normalized_query:
        return False
    if normalized_query in normalized_label or normalized_label in normalized_query:
        return True
    query_tokens = {token for token in normalized_query.split() if len(token) >= 3}
    label_tokens = {token for token in normalized_label.split() if len(token) >= 3}
    return bool(query_tokens) and query_tokens.issubset(label_tokens)


def _matching_member(
    members: list[CommandMemberContext], query: str
) -> CommandMemberContext | None:
    matches = [member for member in members if _matches(member.name, query)]
    return matches[0] if len(matches) == 1 else None


def _matching_column(
    columns: list[CommandColumnContext], query: str
) -> CommandColumnContext | None:
    matches = [column for column in columns if _matches(column.name, query)]
    if not matches:
        normalized_query = _normalize(query)
        category = "in_progress" if "progress" in normalized_query else normalized_query
        matches = [column for column in columns if column.category == category]
    return matches[0] if len(matches) == 1 else None


def build_command_graph():
    """Build a deterministic interpretation graph over Node-supplied project context."""
    graph = StateGraph(CommandGraphState)

    def interpret(state: CommandGraphState) -> dict[str, object]:
        payload = state["payload"]
        text = _normalize(payload.text)
        if "overdue" in text and re.search(r"\b(what|which|show|list|are)\b", text):
            return {"intent": "list_overdue_tasks", "entity_text": ""}

        compound_match = re.search(
            rf"\b(?:move|set|mark)\s+(.+?)\s+(?:to|as)\s+(.+?)"
            rf"\s+(?:and|,)\s+(?:also\s+)?(?:add(?:\s+{ASSIGNEE_WORD})?|assign)"
            rf"\s+(.+?)(?:\s+as\s+well)?$",
            payload.text,
            re.IGNORECASE,
        )
        if compound_match:
            column = _matching_column(payload.columns, compound_match.group(2).strip())
            member = _matching_member(payload.members, compound_match.group(3).strip())
            if column and member:
                return {
                    "intent": "update_task_status",
                    "entity_text": compound_match.group(1).strip(),
                    "target_column": column,
                    "target_member": member,
                }

        add_assignee_match = re.search(
            rf"\badd\s+(?:(.+?)\s+as\s+(?:an?\s+)?{ASSIGNEE_WORD}|"
            rf"{ASSIGNEE_WORD}\s+(.+?))\s+(?:in|to|on)\s+(.+)$",
            payload.text,
            re.IGNORECASE,
        )
        if add_assignee_match:
            member_text = (add_assignee_match.group(1) or add_assignee_match.group(2)).strip()
            member = _matching_member(payload.members, member_text)
            if member:
                return {
                    "intent": "assign_task",
                    "entity_text": add_assignee_match.group(3).strip(),
                    "target_member": member,
                }

        assign_match = re.search(r"\bassign\s+(.+?)\s+to\s+(.+)$", payload.text, re.IGNORECASE)
        if assign_match:
            member_text = assign_match.group(2).strip()
            member = _matching_member(payload.members, member_text)
            if member:
                return {
                    "intent": "assign_task",
                    "entity_text": assign_match.group(1).strip(),
                    "target_member": member,
                }

        move_match = re.search(
            r"\b(?:move|set|mark)\s+(.+?)\s+(?:to|as)\s+(.+)$",
            payload.text,
            re.IGNORECASE,
        )
        if move_match:
            destination = move_match.group(2).strip()
            column = _matching_column(payload.columns, destination)
            if column:
                return {
                    "intent": "update_task_status",
                    "entity_text": move_match.group(1).strip(),
                    "target_column": column,
                }
        return {"intent": "unknown", "entity_text": ""}

    def resolve(state: CommandGraphState) -> dict[str, object]:
        if state["intent"] not in {"update_task_status", "assign_task"}:
            return {"task_matches": []}
        matches = [
            task for task in state["payload"].tasks if _matches(task.title, state["entity_text"])
        ]
        return {"task_matches": matches}

    def prepare(state: CommandGraphState) -> dict[str, object]:
        payload = state["payload"]
        intent = state["intent"]
        matches = state["task_matches"]
        if intent == "list_overdue_tasks":
            result = CommandInterpretResult(
                commandId=payload.command_id,
                status="resolved",
                intent="list_overdue_tasks",
                requiresConfirmation=False,
                preview="Show overdue tasks in this project.",
            )
        elif intent == "unknown":
            result = CommandInterpretResult(
                commandId=payload.command_id,
                status="unsupported",
                intent="unknown",
                requiresConfirmation=False,
                preview="Relay could not understand that command yet.",
            )
        elif len(matches) != 1:
            result = CommandInterpretResult(
                commandId=payload.command_id,
                status="ambiguous",
                intent=intent,
                requiresConfirmation=False,
                preview=(
                    "No matching task was found."
                    if not matches
                    else "More than one task matches. Choose a more specific task name."
                ),
                candidateMatches=[
                    CommandCandidateMatch(id=task.id, label=task.title) for task in matches
                ],
            )
        else:
            task = matches[0]
            if intent == "update_task_status":
                column = state["target_column"]
                member = state.get("target_member")
                result = CommandInterpretResult(
                    commandId=payload.command_id,
                    status="resolved",
                    intent="update_task_status",
                    taskId=task.id,
                    targetColumnId=column.id,
                    targetAssigneeId=member.id if member else None,
                    requiresConfirmation=True,
                    preview=(
                        f"Move “{task.title}” to {column.name} and assign it to {member.name}?"
                        if member
                        else f"Move “{task.title}” to {column.name}?"
                    ),
                )
            else:
                member = state["target_member"]
                result = CommandInterpretResult(
                    commandId=payload.command_id,
                    status="resolved",
                    intent="assign_task",
                    taskId=task.id,
                    targetAssigneeId=member.id,
                    requiresConfirmation=True,
                    preview=f"Assign “{task.title}” to {member.name}?",
                )
        return {"result": result}

    graph.add_node("interpret_intent", interpret)
    graph.add_node("resolve_task_entity", resolve)
    graph.add_node("prepare_command_result", prepare)
    graph.add_edge(START, "interpret_intent")
    graph.add_edge("interpret_intent", "resolve_task_entity")
    graph.add_edge("resolve_task_entity", "prepare_command_result")
    graph.add_edge("prepare_command_result", END)
    return graph.compile()


async def run_command_graph(payload: CommandInterpretPayload) -> CommandInterpretResult:
    result = (await build_command_graph().ainvoke({"payload": payload})).get("result")
    if result is None:
        raise RuntimeError("command graph completed without a result")
    return result
