"""Integration test: GET /health returns 200 with expected body."""

import pytest
from httpx import AsyncClient


@pytest.mark.integration
async def test_health_returns_200(client: AsyncClient) -> None:
    """Health endpoint should return 200 with status ok."""
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


@pytest.mark.integration
async def test_health_has_no_stack_trace(client: AsyncClient) -> None:
    """Health endpoint response must not expose any stack trace."""
    response = await client.get("/health")
    text = response.text
    assert "Traceback" not in text
    assert "traceback" not in text
