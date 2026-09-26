"""WebSocket connection manager and endpoints for real-time draft updates.

Provides:
- In-memory ConnectionManager per draft_id (single Uvicorn worker).
- /ws/drafts/{draft_id} WebSocket endpoint with:
  - Origin header validation against allowed_origins.
  - Session cookie authentication at handshake.
  - Tournament authorization (ADMIN or TEAM_USER of a team in the tournament).
  - Immediate initial DraftState snapshot upon connection.
  - Heartbeat (ping/pong) and clean disconnect handling.
"""

import logging
import uuid
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.auth.domain import User
from app.auth.service import AuthService
from app.common.clock import Clock, SystemClock
from app.config import settings
from app.db import get_session_factory
from app.draft.service import DraftService

logger = logging.getLogger(__name__)

ws_router = APIRouter(tags=["Draft Realtime"])


# ---------------------------------------------------------------------------
# Connection Manager (In-Memory Pub/Sub)
# ---------------------------------------------------------------------------


class ConnectionManager:
    """Manages active WebSocket connections grouped by draft_id."""

    def __init__(self) -> None:
        self._active_connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)

    async def connect(self, draft_id: uuid.UUID, websocket: WebSocket) -> None:
        """Register an active connection for a draft room."""
        self._active_connections[draft_id].add(websocket)
        logger.debug(
            "WebSocket connected to draft=%s (total in room: %d)",
            draft_id,
            len(self._active_connections[draft_id]),
        )

    async def disconnect(self, draft_id: uuid.UUID, websocket: WebSocket) -> None:
        """Unregister a disconnected WebSocket."""
        if draft_id in self._active_connections:
            self._active_connections[draft_id].discard(websocket)
            if not self._active_connections[draft_id]:
                del self._active_connections[draft_id]
        logger.debug("WebSocket disconnected from draft=%s", draft_id)

    async def broadcast(self, draft_id: uuid.UUID, message: dict[str, Any]) -> None:
        """Broadcast JSON message to all active WebSockets in a draft room."""
        sockets = list(self._active_connections.get(draft_id, set()))
        if not sockets:
            return

        dead_sockets: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.warning("Failed to send WebSocket message, removing socket: %s", exc)
                dead_sockets.append(ws)

        for dead in dead_sockets:
            if draft_id in self._active_connections:
                self._active_connections[draft_id].discard(dead)

    def count(self, draft_id: uuid.UUID) -> int:
        """Return number of active connections for a draft room."""
        return len(self._active_connections.get(draft_id, set()))


# Global in-memory connection manager
connection_manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Handshake Validation Helpers
# ---------------------------------------------------------------------------


def _validate_origin(websocket: WebSocket) -> bool:
    """Validate request Origin header against configured allowed origins."""
    origin = websocket.headers.get("origin")
    if not origin:
        # Direct clients (e.g. scripts, native test client) might not send Origin
        return True

    allowed = set(settings.allowed_origins)
    if origin in allowed:
        return True

    # In development/testing, permit common local addresses and Starlette TestClient
    return settings.environment in ("development", "test") and (
        origin.startswith("http://localhost:")
        or origin.startswith("http://127.0.0.1:")
        or origin in ("http://testserver", "https://testserver", "http://test", "https://test")
    )


async def _authenticate_websocket(websocket: WebSocket, clock: Clock) -> User | None:
    """Authenticate WebSocket handshake using session cookie (or Bearer fallback)."""
    token = websocket.cookies.get(settings.session_cookie_name)
    if not token:
        # Fallback to Authorization: Bearer or query param for testing convenience
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif "token" in websocket.query_params:
            token = websocket.query_params["token"]

    if not token:
        return None

    session_factory = get_session_factory()
    async with session_factory() as session:
        auth_service = AuthService(session=session, clock=clock)
        try:
            return await auth_service.authenticate_session(token)
        except Exception as e:
            logger.warning("Failed to authenticate session in websocket: %s", e)
            return None


# ---------------------------------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------------------------------


@ws_router.websocket("/ws/drafts/{draft_id}")
async def draft_websocket_endpoint(
    websocket: WebSocket,
    draft_id: uuid.UUID,
) -> None:
    """WebSocket endpoint for real-time draft state updates.

    Authenticates via session cookie and validates tournament membership.
    Sends initial DraftState snapshot immediately on connect.
    Receives 'ping' and returns 'pong' for heartbeat.
    """
    clock = SystemClock()
    # 1. Validate Origin
    if not _validate_origin(websocket):
        logger.warning(
            "Rejected WebSocket: invalid origin %s (allowed: %s)",
            websocket.headers.get("origin"),
            settings.allowed_origins,
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Authenticate session
    user = await _authenticate_websocket(websocket, clock)
    if user is None:
        logger.warning(
            "Rejected WebSocket: unauthenticated to draft=%s (cookies=%s)",
            draft_id,
            websocket.cookies,
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 3. Authorize tournament access and build initial snapshot
    from app.draft.broadcaster import get_draft_broadcaster

    session_factory = get_session_factory()
    async with session_factory() as session:
        broadcaster = get_draft_broadcaster()
        service = DraftService(session=session, clock=clock, broadcaster=broadcaster)

        is_authorized = await service.is_user_authorized_for_draft(user, draft_id)
        if not is_authorized:
            logger.error(
                "Rejected WebSocket: user=%s not authorized for draft=%s",
                user.username,
                draft_id,
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        snapshot = await service.get_draft_snapshot_dict(draft_id, event_type="INITIAL_SNAPSHOT")
        if snapshot is None:
            logger.error("Rejected WebSocket: draft %s snapshot is None", draft_id)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # 4. Accept connection and send initial snapshot
    await websocket.accept()
    await websocket.send_json(snapshot)
    await connection_manager.connect(draft_id, websocket)

    # 5. Heartbeat / receive loop
    try:
        while True:
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await connection_manager.disconnect(draft_id, websocket)
    except Exception as exc:
        logger.debug("WebSocket exception on draft=%s: %s", draft_id, exc)
        await connection_manager.disconnect(draft_id, websocket)
