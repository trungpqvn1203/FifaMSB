"""FastAPI dependencies for Player and Season modules."""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.clock import Clock, get_clock
from app.db import get_session
from app.player.pool_lock import PoolLockPolicy, get_pool_lock_policy
from app.player.service import PlayerService


def get_player_service(
    session: AsyncSession = Depends(get_session),
    clock: Clock = Depends(get_clock),
    pool_lock_policy: PoolLockPolicy = Depends(get_pool_lock_policy),
) -> PlayerService:
    """Dependency providing a request-scoped PlayerService."""
    return PlayerService(
        session=session,
        clock=clock,
        pool_lock_policy=pool_lock_policy,
    )
