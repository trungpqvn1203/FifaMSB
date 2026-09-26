"""Database queries and repository methods for Matches and Tactical Bans."""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.draft.domain import DraftPick, DraftSession
from app.match.domain import Match, MatchBan
from app.player.domain import PlayerSeason


async def create_match(session: AsyncSession, match: Match) -> Match:
    """Insert a new Match record."""
    session.add(match)
    return match


async def get_match_by_id(
    session: AsyncSession,
    match_id: uuid.UUID,
    for_update: bool = False,
) -> Match | None:
    """Fetch Match by ID with eager loading for teams and bans."""
    stmt = (
        select(Match)
        .where(Match.id == match_id)
        .options(
            selectinload(Match.home_team),
            selectinload(Match.away_team),
            selectinload(Match.bans)
            .selectinload(MatchBan.player_season)
            .selectinload(PlayerSeason.player),
            selectinload(Match.bans)
            .selectinload(MatchBan.player_season)
            .selectinload(PlayerSeason.season),
            selectinload(Match.bans).selectinload(MatchBan.banning_team),
            selectinload(Match.bans).selectinload(MatchBan.target_team),
        )
    )
    if for_update:
        stmt = stmt.with_for_update()
    result = await session.execute(stmt)
    return result.scalars().unique().one_or_none()


async def list_matches_for_tournament(
    session: AsyncSession,
    tournament_id: uuid.UUID,
) -> list[Match]:
    """Fetch all matches for a tournament ordered by scheduled_at and created_at."""
    stmt = (
        select(Match)
        .where(Match.tournament_id == tournament_id)
        .options(
            selectinload(Match.home_team),
            selectinload(Match.away_team),
        )
        .order_by(Match.scheduled_at.asc().nulls_last(), Match.created_at.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().unique().all())


async def create_match_ban(session: AsyncSession, ban: MatchBan) -> MatchBan:
    """Insert a new MatchBan record."""
    session.add(ban)
    return ban


async def delete_match_ban(session: AsyncSession, ban: MatchBan) -> None:
    """Delete a MatchBan record."""
    await session.delete(ban)


async def get_match_ban_by_id(
    session: AsyncSession,
    ban_id: uuid.UUID,
) -> MatchBan | None:
    """Fetch MatchBan by ID."""
    stmt = select(MatchBan).where(MatchBan.id == ban_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_team_bans_count(
    session: AsyncSession,
    match_id: uuid.UUID,
    banning_team_id: uuid.UUID,
) -> int:
    """Count number of bans submitted by a team in a match."""
    stmt = select(func.count(MatchBan.id)).where(
        MatchBan.match_id == match_id, MatchBan.banning_team_id == banning_team_id
    )
    result = await session.execute(stmt)
    return int(result.scalar_one() or 0)


async def is_card_drafted_by_team(
    session: AsyncSession,
    tournament_id: uuid.UUID,
    team_id: uuid.UUID,
    player_season_id: uuid.UUID,
) -> bool:
    """Return True if player_season_id was drafted by team_id in tournament_id (BR-M01)."""
    stmt = (
        select(DraftPick.id)
        .join(DraftSession, DraftPick.draft_session_id == DraftSession.id)
        .where(
            DraftSession.tournament_id == tournament_id,
            DraftPick.team_id == team_id,
            DraftPick.player_season_id == player_season_id,
        )
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none() is not None


async def get_expired_ban_matches(
    session: AsyncSession,
    now: datetime,
) -> list[Match]:
    """Fetch matches currently in BAN_PHASE whose ban_expires_at has passed."""
    stmt = select(Match).where(
        Match.status == "BAN_PHASE",
        Match.ban_expires_at.is_not(None),
        Match.ban_expires_at <= now,
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
