from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed configuration for the AI worker."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = Field(alias="REDIS_URL")
    mongodb_uri: str | None = Field(default=None, alias="MONGODB_URI")
    ai_job_stream: str = Field(default="relay:ai:jobs", alias="AI_JOB_STREAM")
    ai_result_stream: str = Field(default="relay:ai:results", alias="AI_RESULT_STREAM")
    ai_dead_letter_stream: str = Field(
        default="relay:ai:dead-letter", alias="AI_DEAD_LETTER_STREAM"
    )
    ai_worker_consumer_group: str = Field(
        default="relay-ai-workers", alias="AI_WORKER_CONSUMER_GROUP"
    )
    ai_job_schema_version: int = Field(default=1, alias="AI_JOB_SCHEMA_VERSION")
    ai_result_schema_version: int = Field(default=1, alias="AI_RESULT_SCHEMA_VERSION")


def load_settings() -> Settings:
    """Validate environment variables and return worker configuration."""
    return Settings()  # type: ignore[call-arg]
