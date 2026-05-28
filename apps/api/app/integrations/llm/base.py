"""Provider-agnostic LLM interface.

Service code talks to `LlmClient`; provider-specific differences (OpenAI
structured outputs, Anthropic tool use, Gemini response_schema) live
behind their own implementation modules. To add a provider, write a
class that satisfies this Protocol and register it with the factory.

Why a Protocol instead of an ABC: services can be unit-tested with a
hand-rolled fake without having to subclass anything. Bring-your-own
provider is a 50-line change.
"""

from __future__ import annotations

from typing import Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LlmError(Exception):
    """Wraps provider-specific errors so callers can `except LlmError:`."""

    def __init__(self, message: str, *, retryable: bool = False) -> None:
        self.retryable = retryable
        super().__init__(message)


class LlmClient(Protocol):
    """The contract every provider implementation must satisfy.

    Methods are async, return parsed Pydantic models for structured calls
    and plain strings for free-text calls. Temperature defaults are tuned
    for clinical extraction (low) — call sites can override.
    """

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
        """Return a parsed instance of `schema`. Raises LlmError on failure."""
        ...

    async def text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float = 0.4,
        max_output_tokens: int | None = None,
    ) -> str:
        """Return raw model output. Raises LlmError on failure."""
        ...
