"""Database repository for Season, Player, and PlayerSeason entities."""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.player.domain import Player, PlayerSeason, Season
from app.player.position import get_positions_for_group, normalize_position

# ---------------------------------------------------------------------------
# Seasons
# ---------------------------------------------------------------------------


async def get_season_by_code(session: AsyncSession, code: str) -> Season | None:
    """Find a season by its unique code (case-insensitive)."""
    stmt = select(Season).where(func.lower(Season.code) == code.strip().lower())
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_season_by_id(session: AsyncSession, season_id: uuid.UUID) -> Season | None:
    """Find a season by its UUID primary key."""
    stmt = select(Season).where(Season.id == season_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_seasons(session: AsyncSession) -> list[Season]:
    """Return all seasons ordered by year desc, name asc."""
    stmt = select(Season).order_by(Season.year.desc().nullslast(), Season.name.asc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_season(
    session: AsyncSession,
    code: str,
    name: str,
    created_at: datetime,
    badge_url: str | None = None,
    game: str = "FC Online",
    year: int | None = None,
) -> Season:
    """Create and persist a new season."""
    season = Season(
        code=code.strip().upper(),
        name=name.strip(),
        badge_url=badge_url,
        game=game,
        year=year,
        created_at=created_at,
    )
    session.add(season)
    await session.flush()
    return season


# ---------------------------------------------------------------------------
# Players (Master identity)
# ---------------------------------------------------------------------------


async def get_player_by_external_id(
    session: AsyncSession, external_player_id: str
) -> Player | None:
    """Find a master player by unique external player ID."""
    stmt = select(Player).where(Player.external_player_id == external_player_id.strip())
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_player(
    session: AsyncSession,
    name: str,
    external_player_id: str,
    created_at: datetime,
) -> Player:
    """Create and persist a new master player record."""
    player = Player(
        name=name.strip(),
        external_player_id=external_player_id.strip(),
        created_at=created_at,
    )
    session.add(player)
    await session.flush()
    return player


# ---------------------------------------------------------------------------
# PlayerSeason cards
# ---------------------------------------------------------------------------


async def get_player_season_by_id(session: AsyncSession, card_id: uuid.UUID) -> PlayerSeason | None:
    """Find a player season card by ID with player and season loaded."""
    stmt = (
        select(PlayerSeason)
        .options(joinedload(PlayerSeason.player), joinedload(PlayerSeason.season))
        .where(PlayerSeason.id == card_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def update_player_season_salary(
    session: AsyncSession, card_id: uuid.UUID, salary: int
) -> PlayerSeason | None:
    """Update salary of an existing player season card."""
    card = await get_player_season_by_id(session, card_id)
    if card is not None:
        card.salary = salary
        await session.flush()
    return card


async def list_player_seasons(
    session: AsyncSession,
    season_id: uuid.UUID | None = None,
    position: str | None = None,
    position_group: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[PlayerSeason], int]:
    """List player seasons with filters, unaccent trigram search, and pagination."""
    query = select(PlayerSeason).join(PlayerSeason.player).join(PlayerSeason.season)
    count_query = (
        select(func.count(PlayerSeason.id)).join(PlayerSeason.player).join(PlayerSeason.season)
    )

    # Filter by season
    if season_id is not None:
        query = query.where(PlayerSeason.season_id == season_id)
        count_query = count_query.where(PlayerSeason.season_id == season_id)

    # Filter by specific position
    if position:
        norm_pos = normalize_position(position)
        query = query.where(PlayerSeason.position == norm_pos)
        count_query = count_query.where(PlayerSeason.position == norm_pos)
    elif position_group:
        positions = get_positions_for_group(position_group)
        if positions:
            query = query.where(PlayerSeason.position.in_(positions))
            count_query = count_query.where(PlayerSeason.position.in_(positions))

    # Accent-insensitive player name search using immutable_unaccent
    if search and search.strip():
        term = f"%{search.strip()}%"
        search_filter = func.immutable_unaccent(Player.name).ilike(func.immutable_unaccent(term))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Count total matching items
    total_result = await session.execute(count_query)
    total_count = int(total_result.scalar_one() or 0)

    # Ordering & Pagination
    offset = max(0, (page - 1) * page_size)
    query = (
        query.options(joinedload(PlayerSeason.player), joinedload(PlayerSeason.season))
        .order_by(PlayerSeason.rating.desc().nullslast(), PlayerSeason.salary.desc())
        .offset(offset)
        .limit(page_size)
    )

    items_result = await session.execute(query)
    items = list(items_result.scalars().all())

    return items, total_count
