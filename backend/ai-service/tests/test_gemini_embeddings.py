import asyncio
import json

import httpx
import pytest

from relay_ai.providers.gemini_embeddings import GeminiEmbeddingProvider


def test_native_gemini_embedding_adapter_uses_batch_api_and_preserves_order() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1beta/models/gemini-embedding-001:batchEmbedContents"
        assert request.headers["x-goog-api-key"] == "test-key"
        body = json.loads(request.read())
        assert body["requests"] == [
            {
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": "first"}]},
                "taskType": "SEMANTIC_SIMILARITY",
                "outputDimensionality": 2,
            },
            {
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": "second"}]},
                "taskType": "SEMANTIC_SIMILARITY",
                "outputDimensionality": 2,
            },
        ]
        return httpx.Response(
            200,
            json={
                "embeddings": [
                    {"values": [0.1, 0.2]},
                    {"values": [0.3, 0.4]},
                ]
            },
        )

    client = httpx.AsyncClient(
        base_url="https://generativelanguage.googleapis.com/v1beta",
        transport=httpx.MockTransport(handler),
    )
    provider = GeminiEmbeddingProvider(
        api_key="test-key",
        model="gemini-embedding-001",
        dimensions=2,
        client=client,
    )

    vectors = asyncio.run(provider.embed_texts(["first", "second"]))

    assert vectors == [[0.1, 0.2], [0.3, 0.4]]
    asyncio.run(client.aclose())


def test_surfaces_a_retryable_gemini_http_failure() -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": {"message": "temporarily unavailable"}})

    client = httpx.AsyncClient(
        base_url="https://generativelanguage.googleapis.com/v1beta",
        transport=httpx.MockTransport(handler),
    )
    provider = GeminiEmbeddingProvider(api_key="test-key", dimensions=2, client=client)

    with pytest.raises(httpx.HTTPStatusError) as raised:
        asyncio.run(provider.embed_texts(["retry me"]))
    assert raised.value.response.status_code == 503
    asyncio.run(client.aclose())
