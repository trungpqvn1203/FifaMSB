"""DraftBroadcaster Protocol, WebSocket implementation, and dependency provider."""

import logging
import uuid
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from app.draft.ws import ConnectionManager

logger = logging.getLogger(__name__)


class DraftBroadcaster(Protocol):
    """Protocol for pushing real-time draft state updates."""

    async def broadcast(self, draft_id: uuid.UUID, event_type: str, data: dict[str, Any]) -> None:
        """Broadcast an event and its state snapshot to all listeners of the draft."""
        ...


class NoOpDraftBroadcaster:
    """No-op broadcaster used during unit testing."""

    async def broadcast(self, draft_id: uuid.UUID, event_type: str, data: dict[str, Any]) -> None:
        logger.debug(
            "[NoOpBroadcaster] draft=%s event=%s version=%s",
            draft_id,
            event_type,
            data.get("version"),
        )


class WebSocketDraftBroadcaster:
    """Real DraftBroadcaster implementation sending JSON over WebSockets via ConnectionManager."""

    def __init__(self, connection_manager: "ConnectionManager") -> None:
        self._manager = connection_manager

    async def broadcast(self, draft_id: uuid.UUID, event_type: str, data: dict[str, Any]) -> None:
        payload = dict(data)
        payload["eventType"] = event_type
        logger.debug(
            "[WebSocketBroadcaster] Broadcasting draft=%s event=%s version=%s",
            draft_id,
            event_type,
            payload.get("version"),
        )
        await self._manager.broadcast(draft_id, payload)


_default_broadcaster: DraftBroadcaster | None = None


def get_draft_broadcaster() -> DraftBroadcaster:
    """FastAPI dependency provider for DraftBroadcaster."""
    global _default_broadcaster
    if _default_broadcaster is None:
        from app.draft.ws import connection_manager

        _default_broadcaster = WebSocketDraftBroadcaster(connection_manager)
    return _default_broadcaster


def set_draft_broadcaster(broadcaster: DraftBroadcaster | None) -> None:
    """Explicitly set active broadcaster (useful for testing or switching to NoOp)."""
    global _default_broadcaster
    _default_broadcaster = broadcaster
