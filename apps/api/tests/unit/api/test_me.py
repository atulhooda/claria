from fastapi.testclient import TestClient

from app.integrations.clerk import get_clerk_verifier
from app.main import app
from tests.conftest import StubVerifier


def test_me_returns_401_without_authorization(client: TestClient) -> None:
    response = client.get("/api/v1/me")

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert "missing authorization header" in body["error"]["message"].lower()


def test_me_returns_401_with_wrong_scheme(client: TestClient) -> None:
    response = client.get("/api/v1/me", headers={"Authorization": "Basic abc"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_returns_401_with_invalid_token(
    client: TestClient,
    stub_verifier: object,
) -> None:
    response = client.get("/api/v1/me", headers={"Authorization": "Bearer bad"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


def test_me_returns_identity_for_valid_token(
    client: TestClient,
    stub_verifier: object,
) -> None:
    response = client.get("/api/v1/me", headers={"Authorization": "Bearer valid.token.here"})

    assert response.status_code == 200
    body = response.json()
    assert body == {"id": "user_test_123", "sessionId": "sess_test_abc"}


def test_me_returns_401_when_sub_missing(client: TestClient) -> None:
    stub = StubVerifier({"sid": "sess_test_abc"})  # missing `sub`
    app.dependency_overrides[get_clerk_verifier] = lambda: stub

    response = client.get("/api/v1/me", headers={"Authorization": "Bearer valid.token"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"


def test_authed_client_fixture_short_circuits_dependency(
    authed_client: TestClient,
) -> None:
    """`authed_client` bypasses the bearer-token machinery entirely."""
    response = authed_client.get("/api/v1/me")  # no auth header

    assert response.status_code == 200
    assert response.json()["id"] == "user_test_123"
