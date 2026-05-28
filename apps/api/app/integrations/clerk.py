"""Clerk JWT verifier.

Validates Clerk session tokens by fetching the issuer's JWKS document,
matching the JWT's `kid` to a public key, verifying the RS256 signature,
and asserting `iss` / `exp` / `nbf` / (optional) `azp`.

JWKS is cached in-process with a TTL to keep the steady-state verification
cost at one signature check plus a few dict lookups. Cache invalidation
happens automatically; force a refresh by restarting the worker (or by
calling `ClerkVerifier.clear_cache()` in a test).
"""

from __future__ import annotations

import threading
import time
from typing import Any, Final

import httpx
import jwt
import structlog
from jwt import PyJWKClient, PyJWKClientError
from jwt.exceptions import InvalidTokenError

from app.core.exceptions import ExternalServiceError, UnauthorizedError

JWKS_PATH: Final[str] = "/.well-known/jwks.json"
EXPECTED_ALGORITHM: Final[str] = "RS256"

log = structlog.get_logger()


class ClerkVerifier:
    """Verifies Clerk session JWTs against the issuer's JWKS.

    Thread-safe: a single instance can be shared across all workers. The
    JWKS client itself handles its own locking; we only synchronise the
    TTL refresh.
    """

    def __init__(
        self,
        *,
        issuer: str,
        authorized_parties: list[str] | None = None,
        jwks_ttl_seconds: int = 3600,
        http_timeout: float = 5.0,
    ) -> None:
        self._issuer = issuer.rstrip("/")
        self._jwks_url = f"{self._issuer}{JWKS_PATH}"
        self._authorized_parties = set(authorized_parties or [])
        self._jwks_ttl_seconds = jwks_ttl_seconds
        self._http_timeout = http_timeout

        self._lock = threading.Lock()
        self._jwk_client: PyJWKClient | None = None
        self._jwk_client_loaded_at: float = 0.0

    # ------------------------------------------------------------------ public

    def verify(self, token: str) -> dict[str, Any]:
        """Verify a JWT and return its claims dict.

        Raises:
            UnauthorizedError: token is missing required claims, signed by
                an unknown key, expired, or `azp` doesn't match the
                allow-list.
            ExternalServiceError: JWKS endpoint is unreachable. Treated as
                a 5xx since the user did nothing wrong.
        """
        signing_key = self._signing_key_for(token)
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                signing_key,
                algorithms=[EXPECTED_ALGORITHM],
                issuer=self._issuer,
                options={"require": ["exp", "iat", "sub"]},
            )
        except InvalidTokenError as exc:
            raise UnauthorizedError(str(exc), code="INVALID_TOKEN") from exc

        if self._authorized_parties:
            azp = claims.get("azp")
            if azp not in self._authorized_parties:
                raise UnauthorizedError(
                    f"token authorized party is not allowed: {azp!r}",
                    code="INVALID_TOKEN",
                )

        return claims

    def clear_cache(self) -> None:
        """Drop the JWKS cache. Intended for tests; not used in prod."""
        with self._lock:
            self._jwk_client = None
            self._jwk_client_loaded_at = 0.0

    # ---------------------------------------------------------------- internal

    def _signing_key_for(self, token: str) -> Any:
        client = self._get_jwk_client()
        try:
            return client.get_signing_key_from_jwt(token).key
        except PyJWKClientError as exc:
            # Bad key id or JWKS fetch failure inside PyJWT. We can't
            # distinguish "user sent a token signed by a key we don't know"
            # (401) from "JWKS endpoint down" (502) at this layer, so
            # surface both as 401 — the IDs in PyJWT's exception messages
            # are stable enough for ops to triage in logs.
            log.warning("jwks_signing_key_failure", error=str(exc))
            raise UnauthorizedError(
                "unable to resolve JWT signing key", code="INVALID_TOKEN"
            ) from exc

    def _get_jwk_client(self) -> PyJWKClient:
        now = time.monotonic()
        with self._lock:
            if (
                self._jwk_client is None
                or now - self._jwk_client_loaded_at > self._jwks_ttl_seconds
            ):
                try:
                    # Pre-fetch + cache by instantiating; PyJWKClient lazily
                    # fetches on first key lookup, but we want failures to
                    # surface here so we can map them to ExternalServiceError.
                    client = PyJWKClient(
                        self._jwks_url,
                        cache_keys=True,
                        lifespan=self._jwks_ttl_seconds,
                        timeout=self._http_timeout,
                    )
                    # Force the HTTP fetch now to validate connectivity.
                    client.get_jwk_set()
                except (httpx.HTTPError, PyJWKClientError) as exc:
                    log.error("jwks_fetch_failed", url=self._jwks_url, error=str(exc))
                    raise ExternalServiceError("Clerk JWKS endpoint is unreachable") from exc
                self._jwk_client = client
                self._jwk_client_loaded_at = now
            return self._jwk_client


_verifier: ClerkVerifier | None = None
_verifier_lock = threading.Lock()


def get_clerk_verifier() -> ClerkVerifier:
    """Process-wide singleton, built lazily from Settings.

    A separate factory keeps the import graph clean: routes depend on
    `app.api.deps.get_current_user`, which depends on this — never on the
    config module directly.
    """
    global _verifier
    if _verifier is None:
        with _verifier_lock:
            if _verifier is None:
                from app.core.config import get_settings

                settings = get_settings()
                _verifier = ClerkVerifier(
                    issuer=settings.clerk_jwt_issuer,
                    authorized_parties=settings.clerk_authorized_parties,
                    jwks_ttl_seconds=settings.clerk_jwks_ttl_seconds,
                )
    return _verifier


def reset_clerk_verifier() -> None:
    """Clear the singleton. Tests use this to swap implementations."""
    global _verifier
    with _verifier_lock:
        _verifier = None
