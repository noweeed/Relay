"""Provider-neutral boundary for generating semantic task embeddings."""

from typing import Protocol


class EmbeddingProvider(Protocol):
    """Creates vectors for task text without exposing a vendor to the meeting graph."""

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Return one finite, consistently sized vector for every input string."""
        ...
