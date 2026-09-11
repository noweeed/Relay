"""Groq-backed duplicate verifier for vector-search candidates."""

import json
from typing import Any, Literal

from groq import AsyncGroq
from pydantic import BaseModel, ConfigDict, Field, model_validator

from relay_ai.providers.duplicate_verifier import DuplicateVerification
from relay_ai.providers.similarity_search import TaskSimilarityMatch
from relay_ai.schemas.meetings import ExtractedTask

DUPLICATE_VERIFICATION_PROMPT_VERSION = "duplicate-verification.v1"
DUPLICATE_VERIFICATION_SYSTEM_PROMPT = """You verify whether two project tasks describe the same work.
Classify each retrieved task as exactly one of:
- same_work: both tasks require substantially the same deliverable.
- related_but_separate: same area, but different deliverables or steps.
- unrelated: different work.

Be conservative. Similar sentence structure is not enough. Different named products,
systems, services, files, screens, or people usually mean separate work. For example,
"Set up Redis" and "Set up Supabase" are unrelated. Return JSON only."""


class _VerificationRow(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    existing_task_id: str = Field(alias="existingTaskId", min_length=1)
    decision: Literal["same_work", "related_but_separate", "unrelated"]


class _VerificationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    matches: list[_VerificationRow]

    @model_validator(mode="after")
    def unique_task_ids(self) -> "_VerificationResponse":
        ids = [match.existing_task_id for match in self.matches]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate verifier returned repeated existingTaskId values")
        return self


class GroqDuplicateVerifier:
    """Uses a small structured Groq call to verify retrieved duplicate candidates."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "qwen/qwen3.8-27b",
        timeout_seconds: float = 60,
        client: Any | None = None,
    ) -> None:
        if not api_key.strip():
            raise ValueError("GROQ_API_KEY is required")
        self._model = model.strip()
        self._owns_client = client is None
        self._client = client or AsyncGroq(api_key=api_key, timeout=timeout_seconds)

    async def verify_duplicates(
        self,
        candidate: ExtractedTask,
        matches: list[TaskSimilarityMatch],
    ) -> list[DuplicateVerification]:
        expected_ids = {match.task_id for match in matches}
        response = await self._client.chat.completions.create(
            model=self._model,
            temperature=0,
            max_completion_tokens=500,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": DUPLICATE_VERIFICATION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "promptVersion": DUPLICATE_VERIFICATION_PROMPT_VERSION,
                            "newTask": {
                                "title": candidate.title,
                                "description": candidate.description,
                            },
                            "retrievedTasks": [
                                {
                                    "existingTaskId": match.task_id,
                                    "title": match.title,
                                    "description": match.description,
                                    "vectorSimilarity": match.score,
                                }
                                for match in matches
                            ],
                            "outputSchema": _VerificationResponse.model_json_schema(by_alias=True),
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
        )
        content = response.choices[0].message.content if response.choices else None
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Groq duplicate verifier returned no JSON text")
        result = _VerificationResponse.model_validate_json(content)
        returned_ids = {match.existing_task_id for match in result.matches}
        if returned_ids != expected_ids:
            raise ValueError("Groq duplicate verifier did not classify every supplied task")
        return [
            DuplicateVerification(
                existing_task_id=match.existing_task_id,
                decision=match.decision,
            )
            for match in result.matches
        ]

    async def close(self) -> None:
        if self._owns_client:
            await self._client.close()
