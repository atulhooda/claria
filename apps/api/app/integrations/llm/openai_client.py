"""OpenAI implementation of LlmClient.

Uses the OpenAI Structured Outputs API (`response_format=BaseModel`)
which constrains the model's output to a Pydantic schema at decode
time — making invented enums or invalid JSON literally impossible.

Errors are normalized to LlmError with a retryable flag. Network
hiccups and 5xx are retryable; 4xx (bad request / auth) are not.
"""

from __future__ import annotations

import threading
from typing import TypeVar

import structlog
from openai import (
    APIConnectionError,
    APIError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    BadRequestError,
)
from openai import (
    AuthenticationError as OpenAIAuthError,
)
from pydantic import BaseModel

from app.integrations.llm.base import LlmClient, LlmError

log = structlog.get_logger()

T = TypeVar("T", bound=BaseModel)


class OpenAILlmClient(LlmClient):
    """Single-instance OpenAI client. Reuses one AsyncOpenAI across calls."""

    def __init__(self, *, api_key: str, request_timeout_sec: float = 25.0) -> None:
        self._client = AsyncOpenAI(api_key=api_key, timeout=request_timeout_sec)

    async def structured(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        model: str,
        temperature: float = 0.2,
        max_output_tokens: int | None = None,
    ) -> T:
        try:
            completion = await self._client.chat.completions.parse(
                model=model,
                temperature=temperature,
                max_tokens=max_output_tokens,
                response_format=schema,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except (APIConnectionError, APITimeoutError) as exc:
            raise LlmError(f"OpenAI network error: {exc}", retryable=True) from exc
        except APIStatusError as exc:
            retryable = 500 <= exc.status_code < 600
            raise LlmError(
                f"OpenAI HTTP {exc.status_code}: {exc.message}",
                retryable=retryable,
            ) from exc
        except (OpenAIAuthError, BadRequestError) as exc:
            raise LlmError(f"OpenAI rejected request: {exc}", retryable=False) from exc
        except APIError as exc:
            raise LlmError(f"OpenAI error: {exc}", retryable=False) from exc

        choice = completion.choices[0]
        if choice.message.refusal:
            raise LlmError(
                f"Model refused: {choice.message.refusal}", retryable=False
            )
        parsed = choice.message.parsed
        if parsed is None:
            raise LlmError("OpenAI returned no parsed payload", retryable=False)
        return parsed

    async def text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float = 0.4,
        max_output_tokens: int | None = None,
    ) -> str:
        try:
            completion = await self._client.chat.completions.create(
                model=model,
                temperature=temperature,
                max_tokens=max_output_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except (APIConnectionError, APITimeoutError) as exc:
            raise LlmError(f"OpenAI network error: {exc}", retryable=True) from exc
        except APIStatusError as exc:
            retryable = 500 <= exc.status_code < 600
            raise LlmError(
                f"OpenAI HTTP {exc.status_code}: {exc.message}",
                retryable=retryable,
            ) from exc
        except (OpenAIAuthError, BadRequestError) as exc:
            raise LlmError(f"OpenAI rejected request: {exc}", retryable=False) from exc
        except APIError as exc:
            raise LlmError(f"OpenAI error: {exc}", retryable=False) from exc

        content = completion.choices[0].message.content or ""
        return content


# ----- Process-wide singleton, lazily built from Settings --------------------

_client: LlmClient | None = None
_client_lock = threading.Lock()


def get_llm_client() -> LlmClient | None:
    """Return the configured LLM client, or None if no key is set.

    Caller must handle None (i.e. AI features degrade gracefully when the
    server isn't configured for OpenAI yet).
    """
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is None:
            from app.core.config import get_settings

            settings = get_settings()
            if settings.openai_api_key is None:
                return None
            _client = OpenAILlmClient(api_key=settings.openai_api_key.get_secret_value())
        return _client


def reset_llm_client() -> None:
    """Clear the singleton. For tests."""
    global _client
    with _client_lock:
        _client = None
