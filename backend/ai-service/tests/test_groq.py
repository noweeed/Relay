import asyncio
import json
from types import SimpleNamespace

import pytest

from relay_ai.providers.groq import GroqTaskExtractor
from relay_ai.schemas.meetings import MeetingProcessPayload


def meeting_payload() -> MeetingProcessPayload:
    return MeetingProcessPayload.model_validate(
        {
            "meetingId": "meeting-1",
            "title": "Sprint planning",
            "meetingDate": "2026-08-28",
            "projectMembers": [{"userId": "user-1", "name": "Naveed"}],
            "segments": [
                {
                    "segmentId": "segment-1",
                    "order": 0,
                    "speaker": "Naveed",
                    "text": "I will finish authentication by Friday.",
                }
            ],
        }
    )


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


def test_extracts_validated_tasks_through_the_groq_sdk() -> None:
    content = json.dumps(
        {
            "meetingId": "meeting-1",
            "tasks": [
                {
                    "title": "Finish authentication",
                    "assigneeName": "Naveed",
                    "dueDate": "2026-09-04",
                    "priority": "high",
                    "segmentOrder": 0,
                    "sourceQuote": "I will finish authentication by Friday.",
                }
            ],
        }
    )
    client = FakeGroqClient(content)
    extractor = GroqTaskExtractor(api_key="test-key", client=client)

    tasks = asyncio.run(extractor.extract_tasks(meeting_payload(), meeting_payload().segments))

    assert tasks[0].assignee_name == "Naveed"
    assert client.completions.request["model"] == "qwen/qwen3.8-27b"
    assert client.completions.request["max_completion_tokens"] == 800
    messages = client.completions.request["messages"]
    assert isinstance(messages, list)
    assert "sourceQuote" in str(messages[1])


def test_rejects_a_groq_response_for_the_wrong_meeting() -> None:
    client = FakeGroqClient('{"meetingId":"meeting-2","tasks":[]}')
    extractor = GroqTaskExtractor(api_key="test-key", client=client)

    with pytest.raises(ValueError, match="does not match"):
        asyncio.run(extractor.extract_tasks(meeting_payload(), meeting_payload().segments))


def test_rejects_an_empty_provider_response() -> None:
    extractor = GroqTaskExtractor(api_key="test-key", client=FakeGroqClient(""))

    with pytest.raises(ValueError, match="no JSON text"):
        asyncio.run(extractor.extract_tasks(meeting_payload(), meeting_payload().segments))


def test_uses_a_configured_completion_limit() -> None:
    client = FakeGroqClient('{"meetingId":"meeting-1","tasks":[]}')
    extractor = GroqTaskExtractor(
        api_key="test-key",
        max_completion_tokens=640,
        client=client,
    )

    asyncio.run(extractor.extract_tasks(meeting_payload(), meeting_payload().segments))

    assert client.completions.request["max_completion_tokens"] == 640
