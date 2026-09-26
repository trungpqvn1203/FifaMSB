"""Player and Season service layer containing business rules and transactions."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.clock import Clock
from app.common.errors import PlayerNotFound, PoolLocked
from app.player import repository
from app.player.domain import PlayerSeason, Season
from app.player.pool_lock import PoolLockPolicy


class PlayerService:
    """Service handling seasons, player catalogue queries, and salary modifications."""

    def __init__(
        self,
        session: AsyncSession,
        clock: Clock,
        pool_lock_policy: PoolLockPolicy,
    ) -> None:
        self.session = session
        self.clock = clock
        self.pool_lock_policy = pool_lock_policy

    async def list_seasons(self) -> list[Season]:
        """Return all seasons in catalogue."""
        return await repository.list_seasons(self.session)

    async def create_season(
        self,
        code: str,
        name: str,
        badge_url: str | None = None,
        year: int | None = None,
        game: str = "FC Online",
    ) -> Season:
        """Create a new season class."""
        season = await repository.create_season(
            session=self.session,
            code=code,
            name=name,
            badge_url=badge_url,
            game=game,
            year=year,
            created_at=self.clock.now(),
        )
        await self.session.commit()
        return season

    async def list_player_seasons(
        self,
        season_id: uuid.UUID | None = None,
        position: str | None = None,
        position_group: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[PlayerSeason], int]:
        """Search and list player season cards with pagination."""
        return await repository.list_player_seasons(
            session=self.session,
            season_id=season_id,
            position=position,
            position_group=position_group,
            search=search,
            page=page,
            page_size=page_size,
        )

    async def get_player_season(self, card_id: uuid.UUID) -> PlayerSeason:
        """Get player season card by ID.

        Raises:
            PlayerNotFound: If card is not found.
        """
        card = await repository.get_player_season_by_id(self.session, card_id)
        if card is None:
            raise PlayerNotFound(str(card_id))
        return card

    async def update_salary(self, card_id: uuid.UUID, salary: int) -> PlayerSeason:
        """Update the salary of an existing player season card.

        Raises:
            PoolLocked: If a draft session is currently active (PICKING or PAUSED).
            PlayerNotFound: If card does not exist.
        """
        if await self.pool_lock_policy.is_locked():
            raise PoolLocked()

        card = await repository.update_player_season_salary(self.session, card_id, salary)
        if card is None:
            raise PlayerNotFound(str(card_id))

        await self.session.commit()
        return card
