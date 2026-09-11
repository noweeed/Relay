import asyncio
import json
from types import SimpleNamespace

import pytest

from relay_ai.providers.groq_duplicate_verifier import GroqDuplicateVerifier
from relay_ai.providers.similarity_search import TaskSimilarityMatch
from relay_ai.schemas.meetings import ExtractedTask


class FakeCompletions:
    def __init__(self, content: str) -> None:
        self.content = content
        self.request: dict[str, object] = {}

    async def create(self, **request: object) -> object:
        self.request = request
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=self.content))]
        )


class FakeGroqClient:
    def __init__(self, content: str) -> None:
        self.completions = FakeCompletions(content)
        self.chat = SimpleNamespace(completions=self.completions)


def match(task_id: str, title: str, score: float) -> TaskSimilarityMatch:
    return TaskSimilarityMatch(
        task_id=task_id,
        title=title,
        description=None,
        assignee_id=None,
        due_date=None,
        priority="medium",
        score=score,
    )


def candidate() -> ExtractedTask:
    return ExtractedTask(
        title="Set up Redis",
        segmentOrder=0,
        sourceQuote="I will set up Redis",
    )


def test_verifier_classifies_every_retrieved_task() -> None:
    client = FakeGroqClient(
        json.dumps(
            {
                "matches": [
                    {
                        "existingTaskId": "task-1",
                        "decision": "unrelated",
                    }
                ]
            }
        )
    )
    verifier = GroqDuplicateVerifier(api_key="test-key", client=client)

    result = asyncio.run(
        verifier.verify_duplicates(candidate(), [match("task-1", "Set up Supabase", 0.97)])
    )

    assert result[0].decision == "unrelated"
    assert client.completions.request["temperature"] == 0
    assert "Set up Supabase" in str(client.completions.request["messages"])


def test_verifier_rejects_missing_task_decisions() -> None:
    verifier = GroqDuplicateVerifier(
        api_key="test-key",
        client=FakeGroqClient('{"matches":[]}'),
    )

    with pytest.raises(ValueError, match="classify every"):
        asyncio.run(
            verifier.verify_duplicates(candidate(), [match("task-1", "Set up Supabase", 0.97)])
        )
