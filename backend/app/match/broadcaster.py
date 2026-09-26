"""Broadcaster protocol and WebSocket manager for Match real-time events."""

import logging
import uuid
from collections import defaultdict
from typing import Any, Protocol

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class MatchBroadcaster(Protocol):
    """Protocol for broadcasting match state changes outside database transactions."""

    async def broadcast(self, match_id: uuid.UUID, message: dict[str, Any]) -> None:
        """Send message to all clients connected to match_id room."""
        ...


class NoOpMatchBroadcaster:
    """No-op implementation used in unit tests or when realtime is disabled."""

    async def broadcast(self, match_id: uuid.UUID, message: dict[str, Any]) -> None:
        pass


class MatchConnectionManager:
    """Manages active WebSocket connections grouped by match_id."""

    def __init__(self) -> None:
        self._active_connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)

    async def connect(self, match_id: uuid.UUID, websocket: WebSocket) -> None:
        """Register a client WebSocket connection."""
        self._active_connections[match_id].add(websocket)
        logger.debug(
            "Client connected to match room %s (total: %d)",
            match_id,
            len(self._active_connections[match_id]),
        )

    async def disconnect(self, match_id: uuid.UUID, websocket: WebSocket) -> None:
        """Unregister a client WebSocket connection."""
        if match_id in self._active_connections:
            self._active_connections[match_id].discard(websocket)
            if not self._active_connections[match_id]:
                del self._active_connections[match_id]
        logger.debug("Client disconnected from match room %s", match_id)

    async def broadcast(self, match_id: uuid.UUID, message: dict[str, Any]) -> None:
        """Broadcast message to all connected clients in a match room."""
        sockets = list(self._active_connections.get(match_id, set()))
        if not sockets:
            return

        dead_sockets: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.warning("Failed to broadcast to socket in match %s: %s", match_id, exc)
                dead_sockets.append(ws)

        for dead in dead_sockets:
            if match_id in self._active_connections:
                self._active_connections[match_id].discard(dead)

    def count(self, match_id: uuid.UUID) -> int:
        """Return number of connected sockets for a match."""
        return len(self._active_connections.get(match_id, set()))


# Global match connection manager instance
match_connection_manager = MatchConnectionManager()


class WebSocketMatchBroadcaster:
    """Broadcasts match events via match_connection_manager."""

    def __init__(self, manager: MatchConnectionManager = match_connection_manager) -> None:
        self._manager = manager

    async def broadcast(self, match_id: uuid.UUID, message: dict[str, Any]) -> None:
        await self._manager.broadcast(match_id, message)


_broadcaster_instance: MatchBroadcaster = WebSocketMatchBroadcaster()


def get_match_broadcaster() -> MatchBroadcaster:
    """FastAPI dependency provider for MatchBroadcaster."""
    return _broadcaster_instance


def set_match_broadcaster(broadcaster: MatchBroadcaster) -> None:
    """Override broadcaster instance (for testing)."""
    global _broadcaster_instance
    _broadcaster_instance = broadcaster
