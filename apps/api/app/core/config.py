from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: Literal["development", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    api_v1_prefix: str = "/api/v1"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    database_url: str = Field(
        ...,
        description="Async SQLAlchemy URL, e.g. postgresql+asyncpg://user:pass@host/db",
    )

    clerk_jwt_issuer: str = Field(
        ...,
        description=(
            "Clerk JWT issuer URL — used to fetch the JWKS at "
            "{issuer}/.well-known/jwks.json and validate the `iss` claim."
        ),
    )
    clerk_authorized_parties: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        description=(
            "Optional comma-separated allow-list of `azp` (authorized party) values "
            "to enforce. Empty list disables azp validation."
        ),
    )
    clerk_jwks_ttl_seconds: int = Field(
        default=3600,
        ge=60,
        description="In-process JWKS cache TTL.",
    )

    auth_bypass: bool = Field(
        default=False,
        description=(
            "Dev-only: when True, bypass Clerk JWT validation and treat every "
            "request as `user_dev_bypass`. Mirrors the frontend's "
            "NEXT_PUBLIC_AUTH_BYPASS flag so the two halves stay in sync. "
            "Refused at runtime when app_env == 'production'."
        ),
    )

    deepgram_api_key: SecretStr | None = Field(
        default=None,
        description=(
            "Deepgram API key for streaming STT. Required for the consultation "
            "WebSocket endpoint; absence makes /consultations/{id}/stream return "
            "a 503 close code."
        ),
    )
    deepgram_model: str = Field(
        default="nova-3",
        description=(
            "Deepgram model id for live transcription. Default `nova-3` (general) "
            "supports `language=multi` for English+Hindi code-switching, which is "
            "essential for Indian clinical workflows. For English-only deployments "
            "use `nova-3-medical` plus `DEEPGRAM_LANGUAGE=en-US` for the extra "
            "medical-vocabulary boost (medical model is English-only)."
        ),
    )
    deepgram_language: str = Field(
        default="multi",
        description=(
            "BCP-47 language code (or `multi` for code-switching). `multi` enables "
            "Deepgram's multilingual mode and is the right default for Hinglish "
            "consultations. The LLM downstream normalizes outputs to clinical English "
            "regardless of input language."
        ),
    )

    openai_api_key: SecretStr | None = Field(
        default=None,
        description=(
            "OpenAI API key for the clinical AI pipeline (extractions, SOAP "
            "drafting, summary). Absence disables AI generation but the rest "
            "of the consultation pipeline continues to function."
        ),
    )
    openai_model_fast: str = Field(
        default="gpt-4o-mini",
        description="Cheap, low-latency model — used for entity extractions and summaries.",
    )
    openai_model_capable: str = Field(
        default="gpt-4o",
        description="Capable model — used for SOAP refinement.",
    )

    # --- AI pipeline tuning ---
    # Knobs are exposed as env vars so we can dial cost/cadence without code edits.
    ai_extraction_interval_sec: float = Field(
        default=12.0, ge=2.0, description="Min seconds between extraction passes."
    )
    ai_extraction_min_new_lines: int = Field(
        default=1, ge=1, description="Min new finals required to trigger extraction."
    )
    ai_soap_interval_sec: float = Field(
        default=30.0, ge=10.0, description="Min seconds between SOAP refine passes."
    )
    ai_soap_min_new_lines: int = Field(
        default=3, ge=1, description="Min new finals required to trigger SOAP refine."
    )
    ai_summary_interval_sec: float = Field(
        default=60.0, ge=15.0, description="Min seconds between summary passes."
    )

    sentry_dsn: str | None = None

    @field_validator("cors_origins", "clerk_authorized_parties", mode="before")
    @classmethod
    def _parse_comma_list(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def auth_bypass_enabled(self) -> bool:
        """Auth bypass is hard-disabled in production regardless of env flag."""
        return self.auth_bypass and not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
