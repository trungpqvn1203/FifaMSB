"""Integration tests for Draft WebSocket (/ws/drafts/{id}) and DraftTimer on real PostgreSQL.

Tests:
- Handshake without session cookie -> rejected with WS_1008_POLICY_VIOLATION.
- Handshake with unauthorized origin -> rejected with WS_1008_POLICY_VIOLATION.
- Handshake with TEAM_USER of another tournament -> rejected with WS_1008_POLICY_VIOLATION.
- Valid ADMIN and TEAM_USER handshake -> receives initial snapshot with version and serverTime.
- Real-time broadcast: when a pick is made over HTTP, connected WebSockets receive snapshot.
- Real-time broadcast on pause and resume.
- Heartbeat: sending 'ping' responds with 'pong'.
- Background timer timeout: when turn expires, auto-picks and broadcasts TIMEOUT_AUTO_PICK.
"""

import asyncio
import contextlib
import json
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from starlette.types import ASGIApp, Message, Scope
from starlette.websockets import WebSocketDisconnect

from app.auth.domain import User
from app.auth.service import hash_password
from app.common.clock import FakeClock
from app.config import settings
from app.db import get_session_factory
from app.draft.broadcaster import get_draft_broadcaster
from app.draft.timer import DraftTimer
from app.main import app
from app.tournament.domain import Team, Tournament


# ---------------------------------------------------------------------------
# Async ASGI WebSocket Test Helper (runs on same loop, avoiding asyncpg cross-loop issues)
# ---------------------------------------------------------------------------
class AsyncWebSocketSession:
    """Async WebSocket test session running on the active asyncio event loop."""

    def __init__(self, to_app: asyncio.Queue[Message], from_app: asyncio.Queue[Message]) -> None:
        self.to_app = to_app
        self.from_app = from_app

    async def send_text(self, data: str) -> None:
        await self.to_app.put({"type": "websocket.receive", "text": data})

    async def send_json(self, data: Any) -> None:
        await self.to_app.put({"type": "websocket.receive", "text": json.dumps(data)})

    async def receive_text(self) -> str:
        msg = await self.from_app.get()
        if msg["type"] == "websocket.close":
            raise WebSocketDisconnect(code=msg.get("code", 1000), reason=msg.get("reason", ""))
        return str(msg.get("text", ""))

    async def receive_json(self) -> Any:
        text = await self.receive_text()
        return json.loads(text)


@asynccontextmanager
async def async_ws_connect(
    asgi_app: ASGIApp,
    path: str,
    headers: dict[str, str] | None = None,
) -> AsyncGenerator[AsyncWebSocketSession, None]:
    """Connect to an ASGI WebSocket endpoint on the active asyncio event loop."""
    parsed_path, _, query_string = path.partition("?")
    raw_headers: list[tuple[bytes, bytes]] = []
    if headers:
        for k, v in headers.items():
            raw_headers.append((k.lower().encode("latin1"), v.encode("latin1")))

    scope: Scope = {
        "type": "websocket",
        "asgi": {"version": "3.0", "spec_version": "2.4"},
        "http_version": "1.1",
        "scheme": "ws",
        "path": parsed_path,
        "raw_path": parsed_path.encode("ascii"),
        "query_string": query_string.encode("ascii"),
        "headers": raw_headers,
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
        "subprotocols": [],
    }

    to_app: asyncio.Queue[Message] = asyncio.Queue()
    from_app: asyncio.Queue[Message] = asyncio.Queue()

    async def app_receive() -> Message:
        return await to_app.get()

    async def app_send(message: Message) -> None:
        await from_app.put(message)

    app_task = asyncio.create_task(asgi_app(scope, app_receive, app_send))

    # Send handshake connect
    await to_app.put({"type": "websocket.connect"})

    # Wait for accept or close
    first_msg = await from_app.get()
    if first_msg["type"] == "websocket.close":
        code = first_msg.get("code", 1000)
        reason = first_msg.get("reason", "")
        app_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await app_task
        raise WebSocketDisconnect(code=code, reason=reason)

    assert first_msg["type"] == "websocket.accept"
    session = AsyncWebSocketSession(to_app=to_app, from_app=from_app)

    try:
        yield session
    finally:
        await to_app.put({"type": "websocket.disconnect", "code": 1000})
        app_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await app_task


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------
@pytest.mark.integration
async def test_ws_unauthenticated_rejected(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """Connecting to WebSocket without cookie/auth raises 1008 policy violation."""
    trn_id = draft_env["tournament"].id
    res = await client.post(
        f"/api/tournaments/{trn_id}/draft/start",
        cookies={"session_token": draft_env["admin_token"]},
    )
    assert res.status_code == 201
    draft_id = res.json()["id"]

    with pytest.raises(WebSocketDisconnect) as exc_info:
        async with async_ws_connect(app, f"/ws/drafts/{draft_id}"):
            pass

    assert exc_info.value.code == 1008


@pytest.mark.integration
async def test_ws_invalid_origin_rejected(
    client: AsyncClient, draft_env: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Connecting with unapproved origin in production-like config is rejected."""
    trn_id = draft_env["tournament"].id
    res = await client.post(
        f"/api/tournaments/{trn_id}/draft/start",
        cookies={"session_token": draft_env["admin_token"]},
    )
    assert res.status_code == 201
    draft_id = res.json()["id"]

    monkeypatch.setattr(
        "app.draft.ws.settings",
        settings.model_copy(
            update={
                "environment": "production",
                "allowed_origins": ["http://trusted-fifa-tourney.vn"],
            }
        ),
    )

    headers = {
        "cookie": f"{settings.session_cookie_name}={draft_env['admin_token']}",
        "origin": "http://evil-attacker.com",
    }
    with pytest.raises(WebSocketDisconnect) as exc_info:
        async with async_ws_connect(app, f"/ws/drafts/{draft_id}", headers=headers):
            pass

    assert exc_info.value.code == 1008


@pytest.mark.integration
async def test_ws_unauthorized_team_user_rejected(
    client: AsyncClient, draft_env: dict[str, Any], db_session: Any
) -> None:
    """TEAM_USER belonging to another tournament is rejected with 1008."""
    now = datetime.now(UTC)
    other_trn = Tournament(
        id=uuid.uuid4(),
        name="Other Cup",
        status="READY",
        rules={"budget": 305, "rosterSize": 10},
        created_at=now,
        updated_at=now,
    )
    db_session.add(other_trn)
    await db_session.flush()

    other_team = Team(id=uuid.uuid4(), tournament_id=other_trn.id, name="Other FC", draft_order=1)
    db_session.add(other_team)
    await db_session.flush()

    other_user = User(
        id=uuid.uuid4(),
        username="other_team_user_ws",
        password_hash=hash_password("password"),
        role="TEAM_USER",
        team_id=other_team.id,
    )
    db_session.add(other_user)
    await db_session.commit()

    # Login as other user
    login_res = await client.post(
        "/api/auth/login",
        json={"username": "other_team_user_ws", "password": "password"},
    )
    other_token = login_res.cookies[settings.session_cookie_name]

    # Start main draft
    trn_id = draft_env["tournament"].id
    start_res = await client.post(
        f"/api/tournaments/{trn_id}/draft/start",
        cookies={"session_token": draft_env["admin_token"]},
    )
    draft_id = start_res.json()["id"]

    headers = {"cookie": f"{settings.session_cookie_name}={other_token}"}
    with pytest.raises(WebSocketDisconnect) as exc_info:
        async with async_ws_connect(app, f"/ws/drafts/{draft_id}", headers=headers):
            pass

    assert exc_info.value.code == 1008


@pytest.mark.integration
async def test_ws_admin_receives_initial_snapshot(
    client: AsyncClient, draft_env: dict[str, Any]
) -> None:
    """Admin connects and receives immediate initial snapshot."""
    trn_id = draft_env["tournament"].id
    start_res = await client.post(
        f"/api/tournaments/{trn_id}/draft/start",
        cookies={"session_token": draft_env["admin_token"]},
    )
    assert start_res.status_code == 201
    draft_id = start_res.json()["id"]

    headers = {"cookie": f"{settings.session_cookie_name}={draft_env['admin_token']}"}

    async with async_ws_connect(app, f"/ws/drafts/{draft_id}", headers=headers) as ws:
        snapshot = await ws.receive_json()
        assert snapshot["draftId"] == str(draft_id)
        assert snapshot["version"] == 1
        assert snapshot["status"] == "PICKING"
        assert snapshot["eventType"] == "INITIAL_SNAPSHOT"
        assert "serverTime" in snapshot
        assert len(snapshot["teams"]) == 2
        assert snapshot["currentRound"] == 1
        assert snapshot["currentTurn"] == 1


@pytest.mark.integration
async def test_ws_two_clients_receive_broadcast_on_pick(
    client: AsyncClient, draft_env: dict[str, Any]
) -> None:
    """Both Admin and Team 1 connect; when Team 1 picks, both receive PICK_MADE broadcast."""
    trn_id = draft_env["tournament"].id
    start_res = await client.post(
        f"/api/tournaments/{trn_id}/draft/start",
        cookies={"session_token": draft_env["admin_token"]},
    )
    draft_id = start_res.json()["id"]
    card = draft_env["cards"][0]

    admin_headers = {"cookie": f"{settings.session_cookie_name}={draft_env['admin_token']}"}
    team1_headers = {"cookie": f"{settings.session_cookie_name}={draft_env['user1_token']}"}

    async with (
        async_ws_connect(app, f"/ws/drafts/{draft_id}", headers=admin_headers) as ws_admin,
        async_ws_connect(app, f"/ws/drafts/{draft_id}", headers=team1_headers) as ws_team,
    ):
        # Consume initial snapshots
        snap_admin = await ws_admin.receive_json()
        assert snap_admin["eventType"] == "INITIAL_SNAPSHOT"
        snap_team = await ws_team.receive_json()
        assert snap_team["eventType"] == "INITIAL_SNAPSHOT"

        # Team 1 makes pick over HTTP
        pick_res = await client.post(
            f"/api/drafts/{draft_id}/picks",
            json={"playerSeasonId": str(card.id), "expectedVersion": 1},
            cookies={"session_token": draft_env["user1_token"]},
        )
        assert pick_res.status_code == 201

        # Both websockets receive PICK_MADE
        msg_admin = await ws_admin.receive_json()
        assert msg_admin["eventType"] == "PICK_MADE"
        assert msg_admin["version"] == 2
        assert msg_admin["pickedPlayer"] is not None
        assert msg_admin["pickedPlayer"]["playerSeasonId"] == str(card.id)

        msg_team = await ws_team.receive_json()
        assert msg_team["eventType"] == "PICK_MADE"
        assert msg_team["version"] == 2
        assert msg_team["pickedPlayer"]["playerSeasonId"] == str(card.id)


@pytest.mark.integration
async def test_ws_heartbeat_ping_pong(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """Client sends 'ping', server returns 'pong'."""
    trn_id = draft_env["tournament"].id
    start_res = await client.post(
        f"/api/tournaments/{trn_id}/draft/start",
        cookies={"session_token": draft_env["admin_token"]},
    )
    draft_id = start_res.json()["id"]

    headers = {"cookie": f"{settings.session_cookie_name}={draft_env['admin_token']}"}

    async with async_ws_connect(app, f"/ws/drafts/{draft_id}", headers=headers) as ws:
        _ = await ws.receive_json()  # initial snapshot
        await ws.send_text("ping")
        resp = await ws.receive_text()
        assert resp == "pong"


@pytest.mark.integration
async def test_ws_broadcast_on_pause_and_resume(
    client: AsyncClient, draft_env: dict[str, Any]
) -> None:
    """WebSocket receives broadcast updates when draft is paused and resumed."""
    trn_id = draft_env["tournament"].id
    start_res = await client.post(
        f"/api/tournaments/{trn_id}/draft/start",
        cookies={"session_token": draft_env["admin_token"]},
    )
    draft_id = start_res.json()["id"]

    headers = {"cookie": f"{settings.session_cookie_name}={draft_env['admin_token']}"}

    async with async_ws_connect(app, f"/ws/drafts/{draft_id}", headers=headers) as ws:
        _ = await ws.receive_json()  # initial snapshot

        # Pause over HTTP
        pause_res = await client.post(
            f"/api/drafts/{draft_id}/pause",
            cookies={"session_token": draft_env["admin_token"]},
        )
        assert pause_res.status_code == 200

        pause_msg = await ws.receive_json()
        assert pause_msg["eventType"] == "DRAFT_PAUSED"
        assert pause_msg["status"] == "PAUSED"
        assert pause_msg["remainingMillis"] is not None

        # Resume over HTTP
        resume_res = await client.post(
            f"/api/drafts/{draft_id}/resume",
            cookies={"session_token": draft_env["admin_token"]},
        )
        assert resume_res.status_code == 200

        resume_msg = await ws.receive_json()
        assert resume_msg["eventType"] == "DRAFT_RESUMED"
        assert resume_msg["status"] == "PICKING"


@pytest.mark.integration
async def test_draft_timer_auto_picks_and_broadcasts_on_timeout(
    client: AsyncClient, draft_env: dict[str, Any]
) -> None:
    """When a turn expires, DraftTimer processes it, and WebSocket receives TIMEOUT_AUTO_PICK."""
    trn_id = draft_env["tournament"].id
    start_res = await client.post(
        f"/api/tournaments/{trn_id}/draft/start",
        cookies={"session_token": draft_env["admin_token"]},
    )
    draft_id = uuid.UUID(start_res.json()["id"])

    # Simulate time moving past turn_expires_at
    future_time = datetime.now(UTC) + timedelta(minutes=10)
    fake_clock = FakeClock(future_time)

    timer = DraftTimer(
        session_factory=get_session_factory(),
        clock=fake_clock,
        broadcaster=get_draft_broadcaster(),
        poll_interval_seconds=0.1,
    )

    headers = {"cookie": f"{settings.session_cookie_name}={draft_env['admin_token']}"}

    async with async_ws_connect(app, f"/ws/drafts/{draft_id}", headers=headers) as ws:
        _ = await ws.receive_json()  # initial snapshot

        # Execute timer cycle
        processed = await timer.check_and_apply_timeouts()
        assert draft_id in processed

        # WebSocket receives TIMEOUT_AUTO_PICK broadcast
        timeout_msg = await ws.receive_json()
        assert timeout_msg["eventType"] == "TIMEOUT_AUTO_PICK"
        assert timeout_msg["version"] == 2
        assert timeout_msg["pickedPlayer"] is not None
        assert timeout_msg["status"] == "PICKING"
