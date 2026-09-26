"""Unit tests for WebSocket ConnectionManager and origin validation.

No database or network required.
"""

import uuid
from typing import Any

import pytest
from starlette.datastructures import Headers

from app.config import Settings
from app.draft.ws import ConnectionManager, _validate_origin


class DummyWebSocket:
    """Mock WebSocket for unit testing ConnectionManager."""

    def __init__(self) -> None:
        self.sent_messages: list[dict[str, Any]] = []
        self.is_closed = False

    async def send_json(self, message: dict[str, Any]) -> None:
        if self.is_closed:
            raise RuntimeError("Cannot send on closed WebSocket")
        self.sent_messages.append(message)


class FailingWebSocket:
    """Mock WebSocket that always raises on send."""

    async def send_json(self, message: dict[str, Any]) -> None:
        raise RuntimeError("Connection dropped")


class DummyWebSocketWithHeaders:
    """Mock WebSocket providing headers for origin validation test."""

    def __init__(self, headers: dict[str, str]) -> None:
        self.headers = Headers(headers)


@pytest.mark.unit
async def test_connection_manager_connect_and_count() -> None:
    manager = ConnectionManager()
    draft_id = uuid.uuid4()
    ws1 = DummyWebSocket()
    ws2 = DummyWebSocket()

    assert manager.count(draft_id) == 0
    await manager.connect(draft_id, ws1)  # type: ignore[arg-type]
    assert manager.count(draft_id) == 1
    await manager.connect(draft_id, ws2)  # type: ignore[arg-type]
    assert manager.count(draft_id) == 2


@pytest.mark.unit
async def test_connection_manager_disconnect_cleans_up() -> None:
    manager = ConnectionManager()
    draft_id = uuid.uuid4()
    ws1 = DummyWebSocket()

    await manager.connect(draft_id, ws1)  # type: ignore[arg-type]
    assert manager.count(draft_id) == 1

    await manager.disconnect(draft_id, ws1)  # type: ignore[arg-type]
    assert manager.count(draft_id) == 0
    assert draft_id not in manager._active_connections


@pytest.mark.unit
async def test_connection_manager_broadcast_isolated_to_draft() -> None:
    manager = ConnectionManager()
    draft_1 = uuid.uuid4()
    draft_2 = uuid.uuid4()

    ws_d1 = DummyWebSocket()
    ws_d2 = DummyWebSocket()

    await manager.connect(draft_1, ws_d1)  # type: ignore[arg-type]
    await manager.connect(draft_2, ws_d2)  # type: ignore[arg-type]

    msg = {"draftId": str(draft_1), "version": 2, "eventType": "PICK_MADE"}
    await manager.broadcast(draft_1, msg)

    assert len(ws_d1.sent_messages) == 1
    assert ws_d1.sent_messages[0] == msg
    assert len(ws_d2.sent_messages) == 0


@pytest.mark.unit
async def test_connection_manager_broadcast_removes_dead_sockets() -> None:
    manager = ConnectionManager()
    draft_id = uuid.uuid4()

    healthy_ws = DummyWebSocket()
    failing_ws = FailingWebSocket()

    await manager.connect(draft_id, healthy_ws)  # type: ignore[arg-type]
    await manager.connect(draft_id, failing_ws)  # type: ignore[arg-type]
    assert manager.count(draft_id) == 2

    msg = {"version": 3}
    await manager.broadcast(draft_id, msg)

    assert len(healthy_ws.sent_messages) == 1
    # Failing socket was discarded automatically
    assert manager.count(draft_id) == 1


@pytest.mark.unit
def test_validate_origin_no_origin_allowed() -> None:
    ws = DummyWebSocketWithHeaders({})
    assert _validate_origin(ws) is True  # type: ignore[arg-type]


@pytest.mark.unit
def test_validate_origin_allowed_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.draft.ws.settings", Settings(allowed_origins=["http://trusted.com"]))
    ws = DummyWebSocketWithHeaders({"origin": "http://trusted.com"})
    assert _validate_origin(ws) is True  # type: ignore[arg-type]


@pytest.mark.unit
def test_validate_origin_localhost_in_dev() -> None:
    ws = DummyWebSocketWithHeaders({"origin": "http://localhost:5173"})
    assert _validate_origin(ws) is True  # type: ignore[arg-type]


@pytest.mark.unit
def test_validate_origin_rejected_in_prod(monkeypatch: pytest.MonkeyPatch) -> None:
    custom_settings = Settings(
        secret_key="production-secret-key-at-least-32-chars-long",
        environment="production",
        allowed_origins=["http://my-fc-draft.vn"],
    )
    monkeypatch.setattr("app.draft.ws.settings", custom_settings)
    ws = DummyWebSocketWithHeaders({"origin": "http://malicious-site.com"})
    assert _validate_origin(ws) is False  # type: ignore[arg-type]
