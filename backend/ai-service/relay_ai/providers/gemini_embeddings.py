"""Native Google Gemini text embedding adapter."""

import math
from typing import Any

import httpx


class GeminiEmbeddingProvider:
    """Creates task vectors through Gemini's native batchEmbedContents API."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "gemini-embedding-001",
        dimensions: int = 1536,
        timeout_seconds: float = 30,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not api_key.strip():
            raise ValueError("GEMINI_API_KEY is required")
        if not model.strip():
            raise ValueError("GEMINI_EMBEDDING_MODEL is required")
        self._model = model.removeprefix("models/").strip()
        self._model_resource = f"models/{self._model}"
        self._dimensions = dimensions
        self._api_key = api_key
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            base_url="https://generativelanguage.googleapis.com/v1beta",
            headers={"x-goog-api-key": api_key},
            timeout=timeout_seconds,
            trust_env=False,
            transport=httpx.AsyncHTTPTransport(local_address="0.0.0.0"),
        )

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        payload = {
            "requests": [
                {
                    "model": self._model_resource,
                    "content": {"parts": [{"text": text}]},
                    "taskType": "SEMANTIC_SIMILARITY",
                    "outputDimensionality": self._dimensions,
                }
                for text in texts
            ]
        }
        response = await self._client.post(
            f"/models/{self._model}:batchEmbedContents",
            json=payload,
            headers={"x-goog-api-key": self._api_key},
        )
        response.raise_for_status()
        body: Any = response.json()
        rows = body.get("embeddings") if isinstance(body, dict) else None
        if not isinstance(rows, list) or len(rows) != len(texts):
            raise ValueError("Gemini embedding count does not match the input count")

        vectors: list[list[float]] = []
        for row in rows:
            raw = row.get("values") if isinstance(row, dict) else None
            if not isinstance(raw, list) or not raw:
                raise ValueError("Gemini returned an empty embedding")
            vector = [float(value) for value in raw]
            if len(vector) != self._dimensions:
                raise ValueError("Gemini embedding dimensions do not match configuration")
            if not all(math.isfinite(value) for value in vector):
                raise ValueError("Gemini returned a non-finite embedding value")
            vectors.append(vector)
        return vectors

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()
