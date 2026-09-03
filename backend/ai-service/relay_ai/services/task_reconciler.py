"""Deterministic reconciliation for candidates extracted from transcript chunks."""

import re
import unicodedata
from collections.abc import Iterable

from relay_ai.schemas.meetings import ExtractedTask


def _canonical_text(value: str | None) -> str:
    if value is None:
        return ""
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(re.sub(r"[^\w\s]", " ", normalized).split())


def _quality(task: ExtractedTask) -> tuple[float, int, int]:
    """Rank duplicate candidates without changing any model-provided field."""
    completeness = sum(
        value is not None for value in (task.description, task.assignee_name, task.due_date)
    )
    return (
        task.confidence if task.confidence is not None else -1,
        completeness,
        len(task.description or ""),
    )


def reconcile_task_batches(batches: Iterable[Iterable[ExtractedTask]]) -> list[ExtractedTask]:
    """Remove repeated chunk results while preserving stable first-seen ordering.

    Candidates are duplicates when they cite the same verbatim evidence or when their
    normalized title, assignee, and due date are identical. The most informative,
    highest-confidence candidate wins; ties keep the first result for determinism.
    """
    reconciled: list[ExtractedTask] = []
    key_to_index: dict[tuple[str, ...], int] = {}

    for batch in batches:
        for task in batch:
            evidence_key = (
                "evidence",
                str(task.segment_order),
                _canonical_text(task.source_quote),
            )
            action_key = (
                "action",
                _canonical_text(task.title),
                _canonical_text(task.assignee_name),
                task.due_date.isoformat() if task.due_date else "",
            )
            existing_index = key_to_index.get(evidence_key)
            if existing_index is None:
                existing_index = key_to_index.get(action_key)

            if existing_index is None:
                existing_index = len(reconciled)
                reconciled.append(task)
            elif _quality(task) > _quality(reconciled[existing_index]):
                reconciled[existing_index] = task

            key_to_index[evidence_key] = existing_index
            key_to_index[action_key] = existing_index

    return reconciled
