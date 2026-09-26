"""Database queries for the Draft Engine."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.draft.domain import DraftEvent, DraftPick, DraftSession
from app.player.domain import PlayerSeason


async def get_draft_session_by_id(
    session: AsyncSession,
    draft_id: uuid.UUID,
    for_update: bool = False,
) -> DraftSession | None:
    """Fetch a DraftSession by ID, optionally acquiring an exclusive row lock."""
    stmt = select(DraftSession).where(DraftSession.id == draft_id)
    if for_update:
        stmt = stmt.with_for_update()
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_active_session_for_tournament(
    session: AsyncSession,
    tournament_id: uuid.UUID,
) -> DraftSession | None:
    """Fetch the currently active or paused draft session for a tournament."""
    stmt = select(DraftSession).where(
        DraftSession.tournament_id == tournament_id,
        DraftSession.status.in_(["WAITING", "PICKING", "PAUSED"]),
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_latest_session_for_tournament(
    session: AsyncSession,
    tournament_id: uuid.UUID,
) -> DraftSession | None:
    """Fetch the most recently created draft session for a tournament."""
    stmt = (
        select(DraftSession)
        .where(DraftSession.tournament_id == tournament_id)
        .order_by(DraftSession.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_draft_session(
    session: AsyncSession,
    draft_session: DraftSession,
) -> DraftSession:
    """Add a new DraftSession to the session."""
    session.add(draft_session)
    return draft_session


async def save_draft_session(
    session: AsyncSession,
    draft_session: DraftSession,
) -> DraftSession:
    """Track changes to a DraftSession."""
    session.add(draft_session)
    return draft_session


async def create_draft_pick(
    session: AsyncSession,
    pick: DraftPick,
) -> DraftPick:
    """Insert a DraftPick record."""
    session.add(pick)
    return pick


async def list_draft_picks(
    session: AsyncSession,
    draft_session_id: uuid.UUID,
) -> list[DraftPick]:
    """Return all picks in a draft session ordered by turn_number with eager loading."""
    stmt = (
        select(DraftPick)
        .where(DraftPick.draft_session_id == draft_session_id)
        .options(
            joinedload(DraftPick.team),
            joinedload(DraftPick.player_season).joinedload(PlayerSeason.season),
            joinedload(DraftPick.player),
        )
        .order_by(DraftPick.turn_number.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def get_team_picks(
    session: AsyncSession,
    team_id: uuid.UUID,
) -> list[DraftPick]:
    """Return all picks for a team across all rounds ordered by round."""
    stmt = (
        select(DraftPick)
        .where(DraftPick.team_id == team_id)
        .options(
            joinedload(DraftPick.player_season).joinedload(PlayerSeason.season),
            joinedload(DraftPick.player),
        )
        .order_by(DraftPick.round.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def get_picked_player_season_ids(
    session: AsyncSession,
    draft_session_id: uuid.UUID,
) -> set[uuid.UUID]:
    """Return set of all PlayerSeason IDs already picked in this draft session."""
    stmt = select(DraftPick.player_season_id).where(DraftPick.draft_session_id == draft_session_id)
    result = await session.execute(stmt)
    return set(result.scalars().all())


async def get_picked_player_ids(
    session: AsyncSession,
    draft_session_id: uuid.UUID,
) -> set[uuid.UUID]:
    """Return set of all master Player IDs already picked in this draft session."""
    stmt = select(DraftPick.player_id).where(DraftPick.draft_session_id == draft_session_id)
    result = await session.execute(stmt)
    return set(result.scalars().all())


async def count_active_cards_in_pool(
    session: AsyncSession,
    allowed_season_ids: Sequence[uuid.UUID],
) -> int:
    """Count ACTIVE PlayerSeason cards in the tournament's allowed seasons."""
    stmt = select(func.count(PlayerSeason.id)).where(PlayerSeason.status == "ACTIVE")
    if allowed_season_ids:
        stmt = stmt.where(PlayerSeason.season_id.in_(allowed_season_ids))
    result = await session.execute(stmt)
    return result.scalar_one() or 0


async def get_min_salary_in_pool(
    session: AsyncSession,
    allowed_season_ids: Sequence[uuid.UUID],
) -> int:
    """Get the minimum salary of ACTIVE cards in allowed seasons (default 1)."""
    stmt = select(func.min(PlayerSeason.salary)).where(PlayerSeason.status == "ACTIVE")
    if allowed_season_ids:
        stmt = stmt.where(PlayerSeason.season_id.in_(allowed_season_ids))
    result = await session.execute(stmt)
    val = result.scalar_one_or_none()
    return int(val) if val is not None else 1


async def record_draft_event(
    session: AsyncSession,
    draft_session_id: uuid.UUID,
    event_type: str,
    team_id: uuid.UUID | None,
    turn_number: int | None,
    payload: dict[str, Any],
    created_at: datetime,
) -> DraftEvent:
    """Append a DraftEvent to the session audit log."""
    event = DraftEvent(
        id=uuid.uuid4(),
        draft_session_id=draft_session_id,
        type=event_type,
        team_id=team_id,
        turn_number=turn_number,
        payload=payload,
        created_at=created_at,
    )
    session.add(event)
    return event


async def get_player_season_by_id(
    session: AsyncSession,
    player_season_id: uuid.UUID,
) -> PlayerSeason | None:
    """Fetch PlayerSeason with Season and Player relationships eagerly loaded."""
    stmt = (
        select(PlayerSeason)
        .options(joinedload(PlayerSeason.season), joinedload(PlayerSeason.player))
        .where(PlayerSeason.id == player_season_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def find_available_cards_for_autopick(
    session: AsyncSession,
    draft_session_id: uuid.UUID,
    allowed_season_ids: list[uuid.UUID],
    unique_by_player: bool,
    max_salary: int,
) -> list[PlayerSeason]:
    """Fetch candidate ACTIVE cards ordered by salary asc, then id asc for auto-pick."""
    picked_cards = select(DraftPick.player_season_id).where(
        DraftPick.draft_session_id == draft_session_id
    )
    stmt = (
        select(PlayerSeason)
        .options(joinedload(PlayerSeason.season), joinedload(PlayerSeason.player))
        .where(
            PlayerSeason.status == "ACTIVE",
            PlayerSeason.salary <= max_salary,
            PlayerSeason.id.not_in(picked_cards),
        )
    )
    if allowed_season_ids:
        stmt = stmt.where(PlayerSeason.season_id.in_(allowed_season_ids))

    if unique_by_player:
        picked_players = select(DraftPick.player_id).where(
            DraftPick.draft_session_id == draft_session_id,
            DraftPick.unique_by_player.is_(True),
        )
        stmt = stmt.where(PlayerSeason.player_id.not_in(picked_players))

    stmt = stmt.order_by(PlayerSeason.salary.asc(), PlayerSeason.id.asc()).limit(50)
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def find_expired_draft_ids(session: AsyncSession, now: datetime) -> list[uuid.UUID]:
    """Find IDs of all draft sessions currently PICKING whose turn has expired."""
    stmt = (
        select(DraftSession.id)
        .where(
            DraftSession.status == "PICKING",
            DraftSession.turn_expires_at.is_not(None),
            DraftSession.turn_expires_at <= now,
        )
        .order_by(DraftSession.turn_expires_at.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
