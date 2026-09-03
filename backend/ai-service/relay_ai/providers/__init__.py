"""Third-party AI provider adapters."""
"""Provider-neutral AI interfaces and their configured implementations."""

from relay_ai.providers.factory import create_task_extractor
from relay_ai.providers.groq import GroqTaskExtractor
from relay_ai.providers.mock import StaticTaskExtractor
from relay_ai.providers.task_extractor import TaskExtractor

__all__ = [
    "GroqTaskExtractor",
    "StaticTaskExtractor",
    "TaskExtractor",
    "create_task_extractor",
]
