"""Draft background timer loop.

Periodically inspects active draft sessions in status 'PICKING'.
If turn_expires_at has passed according to the injected Clock,
processes timeout in an isolated transaction per draft.
"""

import asyncio
import contextlib
import logging
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.common.clock import Clock
from app.draft import repository
from app.draft.broadcaster import DraftBroadcaster
from app.draft.service import DraftService

logger = logging.getLogger(__name__)


class DraftTimer:
    """Coordinates background inspection of expiring draft turns."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        clock: Clock,
        broadcaster: DraftBroadcaster,
        poll_interval_seconds: float = 1.0,
    ) -> None:
        self._session_factory = session_factory
        self._clock = clock
        self._broadcaster = broadcaster
        self.poll_interval_seconds = poll_interval_seconds

    async def check_and_apply_timeouts(self) -> list[uuid.UUID]:
        """Find expired drafts and apply timeout to each in its own transaction.

        Returns list of draft IDs that had timeouts processed.
        """
        now: datetime = self._clock.now()
        expired_ids: list[uuid.UUID] = []

        async with self._session_factory() as session:
            expired_ids = await repository.find_expired_draft_ids(session, now)

        if not expired_ids:
            return []

        processed_ids: list[uuid.UUID] = []
        for draft_id in expired_ids:
            try:
                async with self._session_factory() as session:
                    service = DraftService(
                        session=session,
                        clock=self._clock,
                        broadcaster=self._broadcaster,
                    )
                    await service.apply_timeout(draft_id)
                    processed_ids.append(draft_id)
                    logger.info("DraftTimer applied timeout for draft=%s", draft_id)
            except Exception as exc:
                logger.exception(
                    "DraftTimer failed applying timeout for draft=%s: %s", draft_id, exc
                )

        return processed_ids

    async def check_and_lock_expired_matches(self) -> list[uuid.UUID]:
        """Find expired BAN_PHASE matches and lock bans per match (BR-TM01)."""
        from app.match import repository as match_repo
        from app.match.broadcaster import get_match_broadcaster
        from app.match.service import MatchService

        now: datetime = self._clock.now()
        async with self._session_factory() as session:
            expired_matches = await match_repo.get_expired_ban_matches(session, now)

        if not expired_matches:
            return []

        locked_match_ids: list[uuid.UUID] = []
        for m in expired_matches:
            try:
                async with self._session_factory() as session:
                    match_service = MatchService(
                        session=session,
                        clock=self._clock,
                        broadcaster=get_match_broadcaster(),
                    )
                    locked = await match_service.lock_expired_bans(m.id)
                    if locked:
                        locked_match_ids.append(m.id)
                        logger.info("DraftTimer locked expired bans for match=%s", m.id)
            except Exception as exc:
                logger.exception("DraftTimer failed locking match=%s: %s", m.id, exc)

        return locked_match_ids

    async def run_loop(self, stop_event: asyncio.Event) -> None:
        """Run the timer loop until stop_event is set."""
        logger.info(
            "DraftTimer background loop started (interval=%.1fs)", self.poll_interval_seconds
        )
        while not stop_event.is_set():
            try:
                await self.check_and_apply_timeouts()
                await self.check_and_lock_expired_matches()
            except Exception as exc:
                logger.exception("Unexpected error in DraftTimer loop: %s", exc)

            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(stop_event.wait(), timeout=self.poll_interval_seconds)

        logger.info("DraftTimer background loop stopped")
