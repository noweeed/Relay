from relay_ai.schemas.meetings import ExtractedTask
from relay_ai.services.task_reconciler import reconcile_task_batches


def task(
    *,
    title: str = "Finish authentication",
    order: int = 1,
    quote: str = "I will finish authentication.",
    confidence: float | None = None,
    description: str | None = None,
) -> ExtractedTask:
    return ExtractedTask(
        title=title,
        segmentOrder=order,
        sourceQuote=quote,
        confidence=confidence,
        description=description,
    )


def test_removes_overlap_duplicate_and_keeps_more_informative_candidate() -> None:
    first = task(confidence=0.7)
    second = task(
        title="Finish Authentication!",
        confidence=0.9,
        description="Complete the remaining login endpoint work.",
    )

    reconciled = reconcile_task_batches([[first], [second]])

    assert reconciled == [second]


def test_preserves_distinct_actions_in_first_seen_order() -> None:
    first = task()
    second = task(
        title="Ship dashboard",
        order=2,
        quote="I will ship the dashboard.",
    )

    assert reconcile_task_batches([[first], [second]]) == [first, second]
