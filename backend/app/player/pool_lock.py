"""Pool lock policy interface and implementations.

Re-import and PATCH /api/admin/player-seasons/{id} are rejected with POOL_LOCKED (422)
if any draft session is in PICKING or PAUSED status.
"""

from typing import Protocol

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session


class PoolLockPolicy(Protocol):
    """Protocol for verifying if player pool is locked against modifications."""

    async def is_locked(self) -> bool:
        """Return True if pool is locked by an active draft, False otherwise."""
        ...


class DefaultPoolLockPolicy:
    """Default policy returning not locked (used in offline CLI scripts)."""

    async def is_locked(self) -> bool:
        return False


class DatabasePoolLockPolicy:
    """Database-backed policy checking if any draft is in PICKING or PAUSED status."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def is_locked(self) -> bool:
        from app.draft.domain import DraftSession

        stmt = select(
            select(DraftSession.id).where(DraftSession.status.in_(["PICKING", "PAUSED"])).exists()
        )
        result = await self._session.execute(stmt)
        return bool(result.scalar())


def get_pool_lock_policy(
    session: AsyncSession = Depends(get_session),
) -> PoolLockPolicy:
    """FastAPI dependency providing DatabasePoolLockPolicy."""
    return DatabasePoolLockPolicy(session)
