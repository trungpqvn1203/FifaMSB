"""WebSocket connection manager and endpoint for real-time match & ban phase updates."""

import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.auth.domain import User
from app.auth.service import AuthService
from app.common.clock import Clock, SystemClock
from app.config import settings
from app.db import get_session_factory
from app.match.broadcaster import get_match_broadcaster, match_connection_manager
from app.match.service import MatchService

logger = logging.getLogger(__name__)

match_ws_router = APIRouter(tags=["Match Realtime"])


def _validate_origin(websocket: WebSocket) -> bool:
    """Validate request Origin header against configured allowed origins."""
    origin = websocket.headers.get("origin")
    if not origin:
        return True

    allowed = set(settings.allowed_origins)
    if origin in allowed:
        return True

    return settings.environment in ("development", "test") and (
        origin.startswith("http://localhost:")
        or origin.startswith("http://127.0.0.1:")
        or origin in ("http://testserver", "https://testserver", "http://test", "https://test")
    )


async def _authenticate_websocket(websocket: WebSocket, clock: Clock) -> User | None:
    """Authenticate WebSocket handshake using session cookie (or query token fallback)."""
    token = websocket.cookies.get(settings.session_cookie_name)
    if not token:
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
            logger.warning("Failed to authenticate session in match websocket: %s", e)
            return None


@match_ws_router.websocket("/ws/matches/{match_id}")
async def match_websocket_endpoint(
    websocket: WebSocket,
    match_id: uuid.UUID,
) -> None:
    """WebSocket endpoint for real-time match ban phase updates."""
    clock = SystemClock()

    # 1. Validate Origin
    if not _validate_origin(websocket):
        logger.warning(
            "Rejected match WebSocket: invalid origin %s",
            websocket.headers.get("origin"),
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Authenticate session
    user = await _authenticate_websocket(websocket, clock)
    if user is None:
        logger.warning("Rejected match WebSocket: unauthenticated to match=%s", match_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 3. Authorize match access & build initial snapshot
    session_factory = get_session_factory()
    async with session_factory() as session:
        broadcaster = get_match_broadcaster()
        service = MatchService(session=session, clock=clock, broadcaster=broadcaster)
        try:
            match = await service.get_match(match_id)
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Check permission: Admin or member of the match's tournament
        is_authorized = False
        if user.role == "ADMIN":
            is_authorized = True
        elif user.role == "TEAM_USER" and user.team_id is not None:
            is_authorized = match.is_participant(user.team_id)

        if not is_authorized:
            logger.error(
                "Rejected match WebSocket: user=%s not authorized for match=%s",
                user.username,
                match_id,
            )
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        viewer_team_id = user.team_id if user.role == "TEAM_USER" else None
        is_admin = user.role == "ADMIN"
        snapshot = service.build_match_view_dict(
            match, viewer_team_id=viewer_team_id, is_admin=is_admin
        )
        snapshot["eventType"] = "INITIAL_SNAPSHOT"

    # 4. Accept connection and send initial snapshot
    await websocket.accept()
    await websocket.send_json(snapshot)
    await match_connection_manager.connect(match_id, websocket)

    # 5. Heartbeat loop
    try:
        while True:
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await match_connection_manager.disconnect(match_id, websocket)
    except Exception as exc:
        logger.debug("Match WebSocket exception on match=%s: %s", match_id, exc)
        await match_connection_manager.disconnect(match_id, websocket)
