import os
from collections.abc import Iterator
from typing import Any

# Set safe defaults BEFORE the app module is imported so Settings validation
# passes in CI/local without a real .env file. Tests that need a real DB
# or a real Clerk instance should override these via fixtures.
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("CLERK_JWT_ISSUER", "https://example.clerk.accounts.dev")
os.environ.setdefault("CLERK_AUTHORIZED_PARTIES", "http://localhost:3000")

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.core.exceptions import UnauthorizedError
from app.integrations.clerk import ClerkVerifier, get_clerk_verifier, reset_clerk_verifier
from app.main import app
from app.schemas.auth import AuthenticatedUser


class StubVerifier(ClerkVerifier):
    """Verifier that returns canned claims without touching JWKS.

    Skips the real __init__ deliberately — no HTTP, no caches. Token value
    'bad' is treated as invalid so a single fixture covers both happy and
    sad-path tests.
    """

    def __init__(self, claims: dict[str, Any]) -> None:
        self._claims = claims

    def verify(self, token: str) -> dict[str, Any]:
        if token == "bad":
            raise UnauthorizedError("bad token", code="INVALID_TOKEN")
        return self._claims


def _reset() -> None:
    app.dependency_overrides.clear()
    reset_clerk_verifier()


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Vanilla TestClient. Protected routes will 401 unless `authed_client` is used."""
    with TestClient(app) as c:
        yield c
    _reset()


@pytest.fixture
def stub_verifier() -> Iterator[StubVerifier]:
    """Inject a fake JWKS-free verifier so deps that only need verify() work."""
    stub = StubVerifier({"sub": "user_test_123", "sid": "sess_test_abc"})
    app.dependency_overrides[get_clerk_verifier] = lambda: stub
    yield stub
    _reset()


@pytest.fixture
def authed_client(stub_verifier: StubVerifier) -> Iterator[TestClient]:
    """Test client whose protected routes resolve to a fixed test identity.

    Useful for route-logic tests that don't care about the auth mechanism.
    Auth-mechanism tests should instead use `client` + `stub_verifier`
    and exercise the real `get_current_user` flow with a real Authorization
    header.
    """
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id="user_test_123", session_id="sess_test_abc"
    )
    with TestClient(app) as c:
        yield c
    _reset()
