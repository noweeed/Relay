"""Configuration-driven construction of AI provider adapters."""

from relay_ai.config import Settings
from relay_ai.providers.duplicate_verifier import DuplicateVerifier
from relay_ai.providers.embedding import EmbeddingProvider
from relay_ai.providers.gemini_embeddings import GeminiEmbeddingProvider
from relay_ai.providers.groq import GroqTaskExtractor
from relay_ai.providers.groq_duplicate_verifier import GroqDuplicateVerifier
from relay_ai.providers.groq_transcription import GroqTranscriptionProvider
from relay_ai.providers.mongo_atlas_search import MongoAtlasTaskSimilaritySearch
from relay_ai.providers.similarity_search import TaskSimilaritySearch
from relay_ai.providers.task_extractor import TaskExtractor
from relay_ai.providers.transcription import TranscriptionProvider


def create_task_extractor(settings: Settings) -> TaskExtractor:
    """Build the configured extractor and fail clearly when required secrets are absent."""
    if settings.groq_api_key is None:
        raise ValueError("GROQ_API_KEY is required for task extraction")

    return GroqTaskExtractor(
        api_key=settings.groq_api_key.get_secret_value(),
        model=settings.groq_model,
        timeout_seconds=settings.groq_timeout_seconds,
        max_completion_tokens=settings.groq_max_completion_tokens,
    )


def create_transcription_provider(settings: Settings) -> TranscriptionProvider:
    """Build the configured timestamped speech-to-text adapter."""
    if settings.groq_api_key is None:
        raise ValueError("GROQ_API_KEY is required for transcription")
    return GroqTranscriptionProvider(
        api_key=settings.groq_api_key.get_secret_value(),
        model=settings.groq_transcription_model,
        language=settings.groq_transcription_language,
        timeout_seconds=settings.groq_transcription_timeout_seconds,
    )


def create_embedding_provider(settings: Settings) -> EmbeddingProvider | None:
    """Build native Gemini embeddings when a Gemini key is configured."""
    if settings.gemini_api_key is None:
        return None
    return GeminiEmbeddingProvider(
        api_key=settings.gemini_api_key.get_secret_value(),
        model=settings.gemini_embedding_model,
        dimensions=settings.embedding_dimensions,
        timeout_seconds=settings.embedding_timeout_seconds,
    )


def create_duplicate_verifier(settings: Settings) -> DuplicateVerifier:
    """Build the conservative model verifier used after vector retrieval."""
    if settings.groq_api_key is None:
        raise ValueError("GROQ_API_KEY is required for duplicate verification")
    return GroqDuplicateVerifier(
        api_key=settings.groq_api_key.get_secret_value(),
        model=settings.groq_model,
        timeout_seconds=settings.groq_timeout_seconds,
    )


def create_similarity_search(settings: Settings) -> TaskSimilaritySearch | None:
    """Build the Atlas reader only when embeddings and MongoDB are configured."""
    if settings.gemini_api_key is None:
        return None
    if not settings.mongodb_uri:
        raise ValueError("MONGODB_URI is required for Atlas duplicate search")
    return MongoAtlasTaskSimilaritySearch(
        mongodb_uri=settings.mongodb_uri,
        database=settings.mongodb_database,
        index_name=settings.atlas_vector_index,
    )
