"""Groq task-extraction adapter using the official Groq Python SDK."""

import json
from typing import Any

from groq import AsyncGroq

from relay_ai.prompts.task_extraction import (
    TASK_EXTRACTION_PROMPT_VERSION,
    TASK_EXTRACTION_SYSTEM_PROMPT,
)
from relay_ai.schemas.meetings import (
    ExtractedTask,
    MeetingExtractionResult,
    MeetingProcessPayload,
    TranscriptSegmentInput,
)


class GroqTaskExtractor:
    """Calls Groq for structured task extraction and validates every response."""

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
        if not model.strip():
            raise ValueError("GROQ_MODEL is required")
        self._model = model.strip()
        self._owns_client = client is None
        self._client = client or AsyncGroq(api_key=api_key, timeout=timeout_seconds)

    async def extract_tasks(
        self,
        payload: MeetingProcessPayload,
        segments: list[TranscriptSegmentInput],
    ) -> list[ExtractedTask]:
        """Request JSON from Groq and preserve the source context sent to the model."""
        model_input = payload.model_dump(mode="json", by_alias=True)
        model_input["segments"] = [
            segment.model_dump(mode="json", by_alias=True, exclude_none=True)
            for segment in segments
        ]
        response = await self._client.chat.completions.create(
            model=self._model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": TASK_EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "promptVersion": TASK_EXTRACTION_PROMPT_VERSION,
                            "meeting": model_input,
                            "outputSchema": MeetingExtractionResult.model_json_schema(
                                by_alias=True
                            ),
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
        )
        content = response.choices[0].message.content if response.choices else None
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Groq response message contains no JSON text")
        result = MeetingExtractionResult.model_validate_json(content)
        if result.meeting_id != payload.meeting_id:
            raise ValueError("Groq response meetingId does not match the requested meeting")
        return result.tasks

    async def close(self) -> None:
        """Close only the Groq client created internally by this adapter."""
        if self._owns_client:
            await self._client.close()
