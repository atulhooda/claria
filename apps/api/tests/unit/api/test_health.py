from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["env"] == "development"
    assert body["version"] == "0.0.0"


def test_health_response_includes_request_id(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert "x-request-id" in response.headers
    assert response.headers["x-request-id"]


def test_health_honours_incoming_request_id(client: TestClient) -> None:
    response = client.get(
        "/api/v1/health", headers={"x-request-id": "test-id-12345"}
    )

    assert response.headers["x-request-id"] == "test-id-12345"
