"""Database queries for Tournament and Team entities."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.tournament.domain import Team, Tournament


async def list_tournaments(session: AsyncSession) -> list[Tournament]:
    """Return all tournaments ordered by creation date (newest first), with teams loaded."""
    result = await session.execute(
        select(Tournament)
        .options(selectinload(Tournament.teams))
        .order_by(Tournament.created_at.desc())
    )
    return list(result.scalars().all())


async def get_tournament_by_id(
    session: AsyncSession, tournament_id: uuid.UUID
) -> Tournament | None:
    """Return a Tournament by its PK, with teams eagerly loaded. Returns None if missing."""
    result = await session.execute(
        select(Tournament)
        .options(selectinload(Tournament.teams))
        .where(Tournament.id == tournament_id)
    )
    return result.scalar_one_or_none()


async def create_tournament(
    session: AsyncSession,
    name: str,
    rules_dict: dict[str, object],
    now: object,  # datetime — typed as object to avoid circular import
) -> Tournament:
    """Insert a new Tournament row and return it (not yet committed)."""
    tournament = Tournament(
        name=name,
        rules=rules_dict,
        status="DRAFT",
        created_at=now,
        updated_at=now,
    )
    session.add(tournament)
    await session.flush()  # populate id without committing
    return tournament


async def save_tournament(session: AsyncSession, tournament: Tournament) -> None:
    """Flush tournament changes (caller owns the transaction)."""
    session.add(tournament)
    await session.flush()


async def list_teams(session: AsyncSession, tournament_id: uuid.UUID) -> list[Team]:
    """Return all teams for a tournament ordered by draft_order."""
    result = await session.execute(
        select(Team).where(Team.tournament_id == tournament_id).order_by(Team.draft_order)
    )
    return list(result.scalars().all())


async def get_team_by_id(session: AsyncSession, team_id: uuid.UUID) -> Team | None:
    """Return a Team by its PK. Returns None if missing."""
    result = await session.execute(select(Team).where(Team.id == team_id))
    return result.scalar_one_or_none()


async def create_team(
    session: AsyncSession,
    tournament_id: uuid.UUID,
    name: str,
    draft_order: int,
) -> Team:
    """Insert a new Team row and return it (not yet committed)."""
    team = Team(
        tournament_id=tournament_id,
        name=name,
        draft_order=draft_order,
    )
    session.add(team)
    await session.flush()
    return team


async def count_teams(session: AsyncSession, tournament_id: uuid.UUID) -> int:
    """Return the number of teams registered in a tournament."""
    result = await session.execute(
        select(func.count()).select_from(Team).where(Team.tournament_id == tournament_id)
    )
    return int(result.scalar_one())


async def save_team(session: AsyncSession, team: Team) -> Team:
    """Track changes to a team."""
    session.add(team)
    return team
