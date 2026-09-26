"""Application service layer for Tournament and Team management.

All database mutations call session.commit() directly — the AsyncSession
from get_session() already manages the connection context.
Do NOT nest async with session.begin() inside a FastAPI-injected session.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.clock import Clock
from app.common.errors import (
    DraftOrderConflict,
    TeamNotFound,
    TournamentNotFound,
    TournamentNotModifiable,
)
from app.tournament import repository
from app.tournament.domain import (
    Team,
    Tournament,
    TournamentRules,
    compute_tournament_status,
)


class TournamentService:
    """Coordinates tournament and team business operations."""

    def __init__(self, session: AsyncSession, clock: Clock) -> None:
        self._session = session
        self._clock = clock

    # ------------------------------------------------------------------
    # Tournament operations
    # ------------------------------------------------------------------

    async def create_tournament(
        self,
        name: str,
        rules: TournamentRules,
    ) -> Tournament:
        """Create a new tournament with validated rules.

        The rules dict is stored as-is in the JSONB column after Pydantic validation.
        Status starts as DRAFT (no teams yet).
        """
        now: datetime = self._clock.now()
        tournament = await repository.create_tournament(
            session=self._session,
            name=name,
            rules_dict=rules.to_dict(),
            now=now,
        )
        await self._session.commit()
        # Re-fetch with teams loaded (selectinload) to avoid lazy-load after commit
        created = await repository.get_tournament_by_id(self._session, tournament.id)
        assert created is not None  # we just inserted it
        return created

    async def list_tournaments(self) -> list[Tournament]:
        """Return all tournaments (newest first) with teams loaded."""
        return await repository.list_tournaments(self._session)

    async def get_tournament(self, tournament_id: uuid.UUID) -> Tournament:
        """Return a tournament by ID or raise TournamentNotFound."""
        tournament = await repository.get_tournament_by_id(self._session, tournament_id)
        if tournament is None:
            raise TournamentNotFound(str(tournament_id))
        return tournament

    async def complete_tournament(self, tournament_id: uuid.UUID) -> Tournament:
        """Manually mark a tournament as COMPLETED (ADMIN only).

        Allowed from any non-terminal status. Phase 5+ will add RUNNING guard.
        """
        tournament = await repository.get_tournament_by_id(self._session, tournament_id)
        if tournament is None:
            raise TournamentNotFound(str(tournament_id))
        tournament.status = "COMPLETED"
        tournament.updated_at = self._clock.now()
        await repository.save_tournament(self._session, tournament)
        await self._session.commit()
        # Re-fetch with teams loaded
        updated = await repository.get_tournament_by_id(self._session, tournament_id)
        assert updated is not None
        return updated

    async def update_tournament(
        self,
        tournament_id: uuid.UUID,
        name: str | None = None,
        rules: TournamentRules | None = None,
    ) -> Tournament:
        """Update tournament name and rules (ADMIN only, only in DRAFT or READY status)."""
        tournament = await repository.get_tournament_by_id(self._session, tournament_id)
        if tournament is None:
            raise TournamentNotFound(str(tournament_id))
        if tournament.status not in ("DRAFT", "READY"):
            raise TournamentNotModifiable(tournament.status)

        if name is not None and name.strip():
            tournament.name = name.strip()
        if rules is not None:
            tournament.rules = rules.to_dict()

        tournament.updated_at = self._clock.now()
        await repository.save_tournament(self._session, tournament)
        await self._session.commit()

        updated = await repository.get_tournament_by_id(self._session, tournament_id)
        assert updated is not None
        return updated

    # ------------------------------------------------------------------
    # Team operations
    # ------------------------------------------------------------------

    async def add_team(
        self,
        tournament_id: uuid.UUID,
        name: str,
        draft_order: int,
    ) -> Team:
        """Add a team to a tournament.

        Automatically transitions tournament status DRAFT → READY when team count >= 2.
        Raises DraftOrderConflict if draft_order is already taken.
        Raises TournamentNotFound if tournament does not exist.
        """
        tournament = await repository.get_tournament_by_id(self._session, tournament_id)
        if tournament is None:
            raise TournamentNotFound(str(tournament_id))

        try:
            team = await repository.create_team(
                session=self._session,
                tournament_id=tournament_id,
                name=name,
                draft_order=draft_order,
            )
            # Flush so the new team is visible to count_teams below
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            # Map UNIQUE constraint violation on (tournament_id, draft_order)
            if "uq_teams_tournament_id_draft_order" in str(exc.orig):
                raise DraftOrderConflict(draft_order) from exc
            raise

        # Re-count teams and update tournament status if needed
        new_count = await repository.count_teams(self._session, tournament_id)
        new_status = compute_tournament_status(tournament.status, new_count)
        if new_status != tournament.status:
            tournament.status = new_status
            tournament.updated_at = self._clock.now()
            await repository.save_tournament(self._session, tournament)

        await self._session.commit()
        return team

    async def list_teams(self, tournament_id: uuid.UUID) -> list[Team]:
        """Return all teams for a tournament ordered by draft_order.

        Raises TournamentNotFound if tournament does not exist.
        """
        tournament = await repository.get_tournament_by_id(self._session, tournament_id)
        if tournament is None:
            raise TournamentNotFound(str(tournament_id))
        return await repository.list_teams(self._session, tournament_id)

    async def get_team(self, team_id: uuid.UUID) -> Team:
        """Return a team by ID or raise TeamNotFound."""
        team = await repository.get_team_by_id(self._session, team_id)
        if team is None:
            raise TeamNotFound(str(team_id))
        return team

    async def get_team_roster(self, team_id: uuid.UUID) -> tuple[Team, list[Any]]:
        """Return team and its drafted picks."""
        team = await self.get_team(team_id)
        from app.draft.repository import get_team_picks

        picks = await get_team_picks(self._session, team_id)
        return team, picks


def get_tournament_service(
    session: "AsyncSession",
    clock: "Clock",
) -> TournamentService:
    """FastAPI dependency factory for TournamentService."""
    return TournamentService(session=session, clock=clock)
