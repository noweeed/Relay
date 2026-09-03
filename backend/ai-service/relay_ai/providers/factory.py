"""Configuration-driven construction of AI provider adapters."""

from relay_ai.config import Settings
from relay_ai.providers.groq import GroqTaskExtractor
from relay_ai.providers.task_extractor import TaskExtractor


def create_task_extractor(settings: Settings) -> TaskExtractor:
    """Build the configured extractor and fail clearly when required secrets are absent."""
    if settings.groq_api_key is None:
        raise ValueError("GROQ_API_KEY is required for task extraction")

    return GroqTaskExtractor(
        api_key=settings.groq_api_key.get_secret_value(),
        model=settings.groq_model,
        timeout_seconds=settings.groq_timeout_seconds,
    )
