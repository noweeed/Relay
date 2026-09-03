from pydantic import Field, SecretStr
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
    ai_worker_consumer_name: str | None = Field(
        default=None, alias="AI_WORKER_CONSUMER_NAME"
    )
    ai_job_max_attempts: int = Field(default=3, alias="AI_JOB_MAX_ATTEMPTS", ge=1, le=10)
    ai_retry_base_delay_ms: int = Field(
        default=500, alias="AI_RETRY_BASE_DELAY_MS", ge=1, le=60_000
    )
    ai_pending_idle_ms: int = Field(
        default=30_000, alias="AI_PENDING_IDLE_MS", ge=1, le=3_600_000
    )
    ai_job_schema_version: int = Field(default=1, alias="AI_JOB_SCHEMA_VERSION")
    ai_result_schema_version: int = Field(default=1, alias="AI_RESULT_SCHEMA_VERSION")
    groq_api_key: SecretStr | None = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str = Field(default="qwen/qwen3.8-27b", alias="GROQ_MODEL")
    groq_timeout_seconds: float = Field(
        default=60, alias="GROQ_TIMEOUT_SECONDS", gt=0, le=300
    )
    transcript_chunk_max_chars: int = Field(
        default=12_000,
        alias="TRANSCRIPT_CHUNK_MAX_CHARS",
        ge=1_000,
        le=500_000,
    )
    transcript_chunk_overlap_segments: int = Field(
        default=1,
        alias="TRANSCRIPT_CHUNK_OVERLAP_SEGMENTS",
        ge=0,
        le=10,
    )
    transcript_chunk_concurrency: int = Field(
        default=3,
        alias="TRANSCRIPT_CHUNK_CONCURRENCY",
        ge=1,
        le=16,
    )


def load_settings() -> Settings:
    """Validate environment variables and return worker configuration."""
    return Settings()  # type: ignore[call-arg]
