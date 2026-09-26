"""API endpoints and Pydantic schemas for Season, Player, and PlayerSeason cards."""

import math
import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.common.clock import Clock, get_clock
from app.db import get_session
from app.importer.pipeline import ImportReport, run_import_pipeline
from app.player.dependencies import get_player_service
from app.player.domain import Season
from app.player.pool_lock import PoolLockPolicy, get_pool_lock_policy
from app.player.service import PlayerService

seasons_router = APIRouter()
player_seasons_router = APIRouter()
admin_player_router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SeasonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    code: str
    name: str
    badge_url: str | None = Field(default=None, serialization_alias="badgeUrl")
    game: str
    year: int | None = None


class CreateSeasonRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    badge_url: str | None = Field(default=None, alias="badgeUrl")
    year: int | None = None
    game: str = "FC Online"


class PlayerEmbedded(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    name: str
    external_player_id: str = Field(serialization_alias="externalPlayerId")


class SeasonEmbedded(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    code: str
    badge_url: str | None = Field(default=None, serialization_alias="badgeUrl")


class PlayerSeasonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    player_id: uuid.UUID = Field(serialization_alias="playerId")
    season_id: uuid.UUID = Field(serialization_alias="seasonId")
    position: str
    rating: int | None = None
    salary: int
    image_url: str | None = Field(default=None, serialization_alias="imageUrl")
    status: str
    player: PlayerEmbedded
    season: SeasonEmbedded


class PlayerSeasonListResponse(BaseModel):
    items: list[PlayerSeasonResponse]
    total: int
    page: int
    page_size: int = Field(serialization_alias="pageSize")
    total_pages: int = Field(serialization_alias="totalPages")


class UpdateSalaryRequest(BaseModel):
    salary: int = Field(ge=1)


# ---------------------------------------------------------------------------
# Seasons endpoints
# ---------------------------------------------------------------------------


@seasons_router.get("", response_model=list[SeasonResponse])
async def list_seasons(
    service: PlayerService = Depends(get_player_service),
) -> list[Season]:
    """List all card seasons/classes."""
    return await service.list_seasons()


@seasons_router.post(
    "",
    response_model=SeasonResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_season(
    payload: CreateSeasonRequest,
    service: PlayerService = Depends(get_player_service),
) -> Season:
    """Create a new season class (Admin only)."""
    return await service.create_season(
        code=payload.code,
        name=payload.name,
        badge_url=payload.badge_url,
        year=payload.year,
        game=payload.game,
    )


# ---------------------------------------------------------------------------
# PlayerSeason catalogue endpoints
# ---------------------------------------------------------------------------


@player_seasons_router.get("", response_model=PlayerSeasonListResponse)
async def list_player_seasons(
    season_id: Annotated[uuid.UUID | None, Query(alias="seasonId")] = None,
    position: str | None = None,
    group: str | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100, alias="pageSize"),
    service: PlayerService = Depends(get_player_service),
) -> PlayerSeasonListResponse:
    """Search and paginate player season cards with filters.

    Supports unaccented Vietnamese search, exact position, or position groups (FW, MF, DF, GK).
    """
    items, total = await service.list_player_seasons(
        season_id=season_id,
        position=position,
        position_group=group,
        search=search,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    return PlayerSeasonListResponse(
        items=[PlayerSeasonResponse.model_validate(card) for card in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@player_seasons_router.get("/{card_id}", response_model=PlayerSeasonResponse)
async def get_player_season(
    card_id: uuid.UUID,
    service: PlayerService = Depends(get_player_service),
) -> PlayerSeasonResponse:
    """Get player season card detail by UUID."""
    card = await service.get_player_season(card_id)
    return PlayerSeasonResponse.model_validate(card)


# ---------------------------------------------------------------------------
# Admin player & import endpoints
# ---------------------------------------------------------------------------


@admin_player_router.patch(
    "/player-seasons/{card_id}",
    response_model=PlayerSeasonResponse,
    dependencies=[Depends(require_admin)],
)
async def update_player_salary(
    card_id: uuid.UUID,
    payload: UpdateSalaryRequest,
    service: PlayerService = Depends(get_player_service),
) -> PlayerSeasonResponse:
    """Update salary of a card (Admin only; rejected with POOL_LOCKED if draft active)."""
    card = await service.update_salary(card_id, payload.salary)
    return PlayerSeasonResponse.model_validate(card)


@admin_player_router.post(
    "/players/import",
    response_model=ImportReport,
    dependencies=[Depends(require_admin)],
)
async def import_players_csv(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    clock: Clock = Depends(get_clock),
    pool_lock_policy: PoolLockPolicy = Depends(get_pool_lock_policy),
) -> ImportReport:
    """Import cards from CSV upload (Admin only; rejected with POOL_LOCKED if draft active)."""
    return await run_import_pipeline(
        session=session,
        clock=clock,
        pool_lock_policy=pool_lock_policy,
        source=file.file,
    )
