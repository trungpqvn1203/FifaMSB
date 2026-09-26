"""API endpoints and Pydantic schemas for Matches and Tactical Bans."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_team,
    get_optional_current_user,
    require_admin,
)
from app.auth.domain import User
from app.common.clock import Clock, get_clock
from app.db import get_session
from app.match.broadcaster import MatchBroadcaster, get_match_broadcaster
from app.match.service import MatchService

matches_router = APIRouter(prefix="/api/matches", tags=["Matches"])
tournaments_match_router = APIRouter(prefix="/api/tournaments", tags=["Matches"])


def get_match_service(
    session: AsyncSession = Depends(get_session),
    clock: Clock = Depends(get_clock),
    broadcaster: MatchBroadcaster = Depends(get_match_broadcaster),
) -> MatchService:
    return MatchService(session=session, clock=clock, broadcaster=broadcaster)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateMatchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    home_team_id: uuid.UUID = Field(alias="homeTeamId")
    away_team_id: uuid.UUID = Field(alias="awayTeamId")
    scheduled_at: str | None = Field(default=None, alias="scheduledAt")


class SubmitBanRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    player_season_id: uuid.UUID = Field(alias="playerSeasonId")
    target_team_id: uuid.UUID | None = Field(default=None, alias="targetTeamId")


class TeamSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    name: str
    confirmed: bool = False
    ban_count: int = Field(default=0, serialization_alias="banCount")


class BanItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    banning_team_id: uuid.UUID = Field(serialization_alias="banningTeamId")
    target_team_id: uuid.UUID = Field(serialization_alias="targetTeamId")
    player_season_id: uuid.UUID = Field(serialization_alias="playerSeasonId")
    player_name: str = Field(serialization_alias="playerName")
    position: str
    rating: int = 0
    season_code: str = Field(serialization_alias="seasonCode")
    season_badge_url: str | None = Field(None, serialization_alias="seasonBadgeUrl")
    created_at: str = Field(serialization_alias="createdAt")


class MatchDetailResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    tournament_id: uuid.UUID = Field(serialization_alias="tournamentId")
    status: str
    scheduled_at: str | None = Field(None, serialization_alias="scheduledAt")
    ban_started_at: str | None = Field(None, serialization_alias="banStartedAt")
    ban_expires_at: str | None = Field(None, serialization_alias="banExpiresAt")
    version: int
    server_time: str = Field(serialization_alias="serverTime")
    rules_snapshot: dict[str, Any] = Field(serialization_alias="rulesSnapshot")
    home_team: TeamSummary = Field(serialization_alias="homeTeam")
    away_team: TeamSummary = Field(serialization_alias="awayTeam")
    bans: list[BanItemResponse] = []

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MatchDetailResponse":
        return cls(
            id=uuid.UUID(data["id"]),
            tournament_id=uuid.UUID(data["tournamentId"]),
            status=data["status"],
            scheduled_at=data["scheduledAt"],
            ban_started_at=data["banStartedAt"],
            ban_expires_at=data["banExpiresAt"],
            version=data["version"],
            server_time=data["serverTime"],
            rules_snapshot=data["rulesSnapshot"],
            home_team=TeamSummary(
                id=uuid.UUID(data["homeTeam"]["id"]),
                name=data["homeTeam"]["name"],
                confirmed=data["homeTeam"]["confirmed"],
                ban_count=data["homeTeam"]["banCount"],
            ),
            away_team=TeamSummary(
                id=uuid.UUID(data["awayTeam"]["id"]),
                name=data["awayTeam"]["name"],
                confirmed=data["awayTeam"]["confirmed"],
                ban_count=data["awayTeam"]["banCount"],
            ),
            bans=[
                BanItemResponse(
                    id=uuid.UUID(b["id"]),
                    banning_team_id=uuid.UUID(b["banningTeamId"]),
                    target_team_id=uuid.UUID(b["targetTeamId"]),
                    player_season_id=uuid.UUID(b["playerSeasonId"]),
                    player_name=b["playerName"],
                    position=b["position"],
                    rating=b["rating"],
                    season_code=b["seasonCode"],
                    season_badge_url=b["seasonBadgeUrl"],
                    created_at=b["createdAt"],
                )
                for b in data.get("bans", [])
            ],
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@tournaments_match_router.post(
    "/{tournament_id}/matches", response_model=MatchDetailResponse, status_code=201
)
async def create_match(
    tournament_id: uuid.UUID,
    body: CreateMatchRequest,
    _admin: object = Depends(require_admin),
    service: MatchService = Depends(get_match_service),
) -> MatchDetailResponse:
    """Schedule a match between two teams in a tournament (ADMIN only)."""
    match = await service.create_match(
        tournament_id=tournament_id,
        home_team_id=body.home_team_id,
        away_team_id=body.away_team_id,
        scheduled_at=body.scheduled_at,
    )
    view_data = service.build_match_view_dict(match, is_admin=True)
    return MatchDetailResponse.from_dict(view_data)


@tournaments_match_router.get("/{tournament_id}/matches", response_model=list[MatchDetailResponse])
async def list_tournament_matches(
    tournament_id: uuid.UUID,
    user: User | None = Depends(get_optional_current_user),
    service: MatchService = Depends(get_match_service),
) -> list[MatchDetailResponse]:
    """List all scheduled and played matches for a tournament."""
    matches = await service.list_matches(tournament_id)
    viewer_team_id = user.team_id if user and user.role == "TEAM_USER" else None
    is_admin = user is not None and user.role == "ADMIN"
    return [
        MatchDetailResponse.from_dict(
            service.build_match_view_dict(m, viewer_team_id=viewer_team_id, is_admin=is_admin)
        )
        for m in matches
    ]


@matches_router.get("/{match_id}", response_model=MatchDetailResponse)
async def get_match_detail(
    match_id: uuid.UUID,
    user: User | None = Depends(get_optional_current_user),
    service: MatchService = Depends(get_match_service),
) -> MatchDetailResponse:
    """Get match details with SIMULTANEOUS ban secrecy applied (BR-M04)."""
    match = await service.get_match(match_id)
    viewer_team_id = user.team_id if user and user.role == "TEAM_USER" else None
    is_admin = user is not None and user.role == "ADMIN"
    view_data = service.build_match_view_dict(
        match, viewer_team_id=viewer_team_id, is_admin=is_admin
    )
    return MatchDetailResponse.from_dict(view_data)


@matches_router.post("/{match_id}/bans/start", response_model=MatchDetailResponse)
async def start_ban_phase(
    match_id: uuid.UUID,
    _admin: object = Depends(require_admin),
    service: MatchService = Depends(get_match_service),
) -> MatchDetailResponse:
    """Start Tactical Ban Phase for a SCHEDULED match (ADMIN only)."""
    match = await service.start_ban_phase(match_id)
    view_data = service.build_match_view_dict(match, is_admin=True)
    return MatchDetailResponse.from_dict(view_data)


@matches_router.post("/{match_id}/bans", response_model=BanItemResponse, status_code=201)
async def submit_ban(
    match_id: uuid.UUID,
    body: SubmitBanRequest,
    current_team_id: uuid.UUID = Depends(get_current_team),
    service: MatchService = Depends(get_match_service),
) -> BanItemResponse:
    """Submit a single player card ban for the authenticated team."""
    ban = await service.submit_ban(
        match_id=match_id,
        banning_team_id=current_team_id,
        player_season_id=body.player_season_id,
        target_team_id=body.target_team_id,
    )
    ps = ban.player_season
    return BanItemResponse(
        id=ban.id,
        banning_team_id=ban.banning_team_id,
        target_team_id=ban.target_team_id,
        player_season_id=ban.player_season_id,
        player_name=ps.player.name if ps and ps.player else "",
        position=ps.position if ps else "",
        rating=ps.rating if ps else 0,
        season_code=ps.season.code if ps and ps.season else "",
        season_badge_url=ps.season.badge_url if ps and ps.season else None,
        created_at=ban.created_at.isoformat(),
    )


@matches_router.delete("/{match_id}/bans/{ban_id}", status_code=204)
async def delete_ban(
    match_id: uuid.UUID,
    ban_id: uuid.UUID,
    current_team_id: uuid.UUID = Depends(get_current_team),
    service: MatchService = Depends(get_match_service),
) -> None:
    """Delete a pending ban before confirmation."""
    await service.delete_ban(
        match_id=match_id,
        banning_team_id=current_team_id,
        ban_id=ban_id,
    )


@matches_router.post("/{match_id}/bans/confirm", response_model=MatchDetailResponse)
async def confirm_bans(
    match_id: uuid.UUID,
    current_team_id: uuid.UUID = Depends(get_current_team),
    service: MatchService = Depends(get_match_service),
) -> MatchDetailResponse:
    """Confirm bans for the authenticated team."""
    match = await service.confirm_bans(match_id, current_team_id)
    view_data = service.build_match_view_dict(match, viewer_team_id=current_team_id)
    return MatchDetailResponse.from_dict(view_data)


@matches_router.post("/{match_id}/complete", response_model=MatchDetailResponse)
async def complete_match(
    match_id: uuid.UUID,
    _admin: object = Depends(require_admin),
    service: MatchService = Depends(get_match_service),
) -> MatchDetailResponse:
    """Mark match as COMPLETED (ADMIN only)."""
    match = await service.complete_match(match_id)
    view_data = service.build_match_view_dict(match, is_admin=True)
    return MatchDetailResponse.from_dict(view_data)
