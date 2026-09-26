"""API endpoints and Pydantic schemas for the Draft Engine."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_team, require_admin
from app.common.clock import Clock, get_clock
from app.db import get_session
from app.draft.broadcaster import DraftBroadcaster, get_draft_broadcaster
from app.draft.domain import DraftPick, DraftSession
from app.draft.service import DraftService

drafts_router = APIRouter(prefix="/api/drafts", tags=["Drafts"])
tournaments_draft_router = APIRouter(prefix="/api/tournaments", tags=["Drafts"])


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------


def get_draft_service(
    session: AsyncSession = Depends(get_session),
    clock: Clock = Depends(get_clock),
    broadcaster: DraftBroadcaster = Depends(get_draft_broadcaster),
) -> DraftService:
    return DraftService(session=session, clock=clock, broadcaster=broadcaster)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class StartDraftResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    tournament_id: uuid.UUID = Field(serialization_alias="tournamentId")
    status: str
    current_round: int = Field(serialization_alias="currentRound")
    current_turn: int = Field(serialization_alias="currentTurn")
    current_team_id: uuid.UUID | None = Field(None, serialization_alias="currentTeamId")
    turn_started_at: str | None = Field(None, serialization_alias="turnStartedAt")
    turn_expires_at: str | None = Field(None, serialization_alias="turnExpiresAt")
    remaining_millis: int | None = Field(None, serialization_alias="remainingMillis")
    rules_snapshot: dict[str, Any] = Field(serialization_alias="rulesSnapshot")
    version: int

    @classmethod
    def from_domain(cls, d: DraftSession) -> "StartDraftResponse":
        return cls(
            id=d.id,
            tournament_id=d.tournament_id,
            status=d.status,
            current_round=d.current_round,
            current_turn=d.current_turn,
            current_team_id=d.current_team_id,
            turn_started_at=d.turn_started_at.isoformat() if d.turn_started_at else None,
            turn_expires_at=d.turn_expires_at.isoformat() if d.turn_expires_at else None,
            remaining_millis=d.remaining_millis,
            rules_snapshot=d.rules_snapshot,
            version=d.version,
        )


class DraftPickRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    player_season_id: uuid.UUID = Field(alias="playerSeasonId")
    expected_version: int = Field(alias="expectedVersion")


class PickResponseItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    round: int
    turn_number: int = Field(serialization_alias="turnNumber")
    team_id: uuid.UUID = Field(serialization_alias="teamId")
    player_season_id: uuid.UUID = Field(serialization_alias="playerSeasonId")
    player_id: uuid.UUID = Field(serialization_alias="playerId")
    salary_at_pick: int = Field(serialization_alias="salaryAtPick")
    picked_at: str = Field(serialization_alias="pickedAt")

    @classmethod
    def from_domain(cls, p: DraftPick) -> "PickResponseItem":
        return cls(
            id=p.id,
            round=p.round,
            turn_number=p.turn_number,
            team_id=p.team_id,
            player_season_id=p.player_season_id,
            player_id=p.player_id,
            salary_at_pick=p.salary_at_pick,
            picked_at=p.picked_at.isoformat(),
        )


class NextStateInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_round: int = Field(serialization_alias="currentRound")
    current_turn: int = Field(serialization_alias="currentTurn")
    current_team_id: uuid.UUID | None = Field(None, serialization_alias="currentTeamId")
    turn_expires_at: str | None = Field(None, serialization_alias="turnExpiresAt")
    status: str
    version: int


class MakePickResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    pick: PickResponseItem
    next_state: NextStateInfo = Field(serialization_alias="nextState")


class SeasonSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    code: str
    name: str
    badge_url: str | None = Field(None, serialization_alias="badgeUrl")


class PickPlayerDetail(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    player_season_id: uuid.UUID = Field(serialization_alias="playerSeasonId")
    player_id: uuid.UUID = Field(serialization_alias="playerId")
    name: str
    position: str
    rating: int | None = None
    salary: int
    image_url: str | None = Field(None, serialization_alias="imageUrl")
    season: SeasonSummary


class PickTeamDetail(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    name: str
    draft_order: int = Field(serialization_alias="draftOrder")


class DraftPickBoardItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    round: int
    turn_number: int = Field(serialization_alias="turnNumber")
    salary_at_pick: int = Field(serialization_alias="salaryAtPick")
    picked_at: str = Field(serialization_alias="pickedAt")
    team: PickTeamDetail
    player: PickPlayerDetail

    @classmethod
    def from_domain(cls, p: DraftPick) -> "DraftPickBoardItem":
        season_model = p.player_season.season
        return cls(
            id=p.id,
            round=p.round,
            turn_number=p.turn_number,
            salary_at_pick=p.salary_at_pick,
            picked_at=p.picked_at.isoformat(),
            team=PickTeamDetail(
                id=p.team.id,
                name=p.team.name,
                draft_order=p.team.draft_order,
            ),
            player=PickPlayerDetail(
                player_season_id=p.player_season.id,
                player_id=p.player.id,
                name=p.player.name,
                position=p.player_season.position,
                rating=p.player_season.rating,
                salary=p.salary_at_pick,
                image_url=p.player_season.image_url,
                season=SeasonSummary(
                    id=season_model.id,
                    code=season_model.code,
                    name=season_model.name,
                    badge_url=season_model.badge_url,
                ),
            ),
        )


class TeamDraftStatus(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    name: str
    draft_order: int = Field(serialization_alias="draftOrder")
    budget_used: int = Field(serialization_alias="budgetUsed")
    budget_remaining: int = Field(serialization_alias="budgetRemaining")
    picked_count: int = Field(serialization_alias="pickedCount")


class DraftDetailResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    tournament_id: uuid.UUID = Field(serialization_alias="tournamentId")
    status: str
    current_round: int = Field(serialization_alias="currentRound")
    current_turn: int = Field(serialization_alias="currentTurn")
    current_team_id: uuid.UUID | None = Field(None, serialization_alias="currentTeamId")
    turn_started_at: str | None = Field(None, serialization_alias="turnStartedAt")
    turn_expires_at: str | None = Field(None, serialization_alias="turnExpiresAt")
    remaining_millis: int | None = Field(None, serialization_alias="remainingMillis")
    version: int
    server_time: str = Field(serialization_alias="serverTime")
    rules_snapshot: dict[str, Any] = Field(serialization_alias="rulesSnapshot")
    teams: list[TeamDraftStatus]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@tournaments_draft_router.post(
    "/{tournament_id}/draft/start", response_model=DraftDetailResponse, status_code=201
)
async def start_draft(
    tournament_id: uuid.UUID,
    _admin: object = Depends(require_admin),
    service: DraftService = Depends(get_draft_service),
) -> DraftDetailResponse:
    """Start a new draft session for a READY tournament (ADMIN only)."""
    draft = await service.start_draft(tournament_id)
    _, teams_status_data, now = await service.get_latest_draft_for_tournament(tournament_id)
    return DraftDetailResponse(
        id=draft.id,
        tournament_id=draft.tournament_id,
        status=draft.status,
        current_round=draft.current_round,
        current_turn=draft.current_turn,
        current_team_id=draft.current_team_id,
        turn_started_at=draft.turn_started_at.isoformat() if draft.turn_started_at else None,
        turn_expires_at=draft.turn_expires_at.isoformat() if draft.turn_expires_at else None,
        remaining_millis=draft.remaining_millis,
        version=draft.version,
        server_time=now.isoformat(),
        rules_snapshot=draft.rules_snapshot,
        teams=[
            TeamDraftStatus(
                id=t.id,
                name=t.name,
                draft_order=t.draft_order,
                budget_used=t.budget_used,
                budget_remaining=t.budget_remaining,
                picked_count=t.picked_count,
            )
            for t in teams_status_data
        ],
    )


@tournaments_draft_router.get("/{tournament_id}/draft", response_model=DraftDetailResponse)
async def get_tournament_draft(
    tournament_id: uuid.UUID,
    service: DraftService = Depends(get_draft_service),
) -> DraftDetailResponse:
    """Get the latest/active draft session details for a tournament."""
    draft, teams_status_data, now = await service.get_latest_draft_for_tournament(tournament_id)
    return DraftDetailResponse(
        id=draft.id,
        tournament_id=draft.tournament_id,
        status=draft.status,
        current_round=draft.current_round,
        current_turn=draft.current_turn,
        current_team_id=draft.current_team_id,
        turn_started_at=draft.turn_started_at.isoformat() if draft.turn_started_at else None,
        turn_expires_at=draft.turn_expires_at.isoformat() if draft.turn_expires_at else None,
        remaining_millis=draft.remaining_millis,
        version=draft.version,
        server_time=now.isoformat(),
        rules_snapshot=draft.rules_snapshot,
        teams=[
            TeamDraftStatus(
                id=t.id,
                name=t.name,
                draft_order=t.draft_order,
                budget_used=t.budget_used,
                budget_remaining=t.budget_remaining,
                picked_count=t.picked_count,
            )
            for t in teams_status_data
        ],
    )


@drafts_router.get("/{draft_id}", response_model=DraftDetailResponse)
async def get_draft_detail(
    draft_id: uuid.UUID,
    service: DraftService = Depends(get_draft_service),
) -> DraftDetailResponse:
    """Get full draft details, current timer, and team status."""
    draft, teams_status_data, now = await service.get_draft_detail_data(draft_id)
    return DraftDetailResponse(
        id=draft.id,
        tournament_id=draft.tournament_id,
        status=draft.status,
        current_round=draft.current_round,
        current_turn=draft.current_turn,
        current_team_id=draft.current_team_id,
        turn_started_at=draft.turn_started_at.isoformat() if draft.turn_started_at else None,
        turn_expires_at=draft.turn_expires_at.isoformat() if draft.turn_expires_at else None,
        remaining_millis=draft.remaining_millis,
        version=draft.version,
        server_time=now.isoformat(),
        rules_snapshot=draft.rules_snapshot,
        teams=[
            TeamDraftStatus(
                id=t.id,
                name=t.name,
                draft_order=t.draft_order,
                budget_used=t.budget_used,
                budget_remaining=t.budget_remaining,
                picked_count=t.picked_count,
            )
            for t in teams_status_data
        ],
    )


@drafts_router.get("/{draft_id}/picks", response_model=list[DraftPickBoardItem])
async def list_draft_picks(
    draft_id: uuid.UUID,
    service: DraftService = Depends(get_draft_service),
) -> list[DraftPickBoardItem]:
    """Get all picks in the draft session formatted for the draft board."""
    picks = await service.list_picks(draft_id)
    return [DraftPickBoardItem.from_domain(p) for p in picks]


@drafts_router.post("/{draft_id}/picks", response_model=MakePickResponse, status_code=201)
async def make_pick(
    draft_id: uuid.UUID,
    body: DraftPickRequest,
    current_team_id: uuid.UUID = Depends(get_current_team),
    service: DraftService = Depends(get_draft_service),
) -> MakePickResponse:
    """Submit a single player card pick for the current team's turn."""
    pick, draft = await service.make_pick(
        draft_id=draft_id,
        team_id=current_team_id,
        player_season_id=body.player_season_id,
        expected_version=body.expected_version,
    )

    next_state = NextStateInfo(
        current_round=draft.current_round,
        current_turn=draft.current_turn,
        current_team_id=draft.current_team_id,
        turn_expires_at=draft.turn_expires_at.isoformat() if draft.turn_expires_at else None,
        status=draft.status,
        version=draft.version,
    )

    return MakePickResponse(
        pick=PickResponseItem.from_domain(pick),
        next_state=next_state,
    )


@drafts_router.post("/{draft_id}/pause", response_model=StartDraftResponse)
async def pause_draft(
    draft_id: uuid.UUID,
    _admin: object = Depends(require_admin),
    service: DraftService = Depends(get_draft_service),
) -> StartDraftResponse:
    """Pause an active draft session (ADMIN only)."""
    draft = await service.pause_draft(draft_id)
    return StartDraftResponse.from_domain(draft)


@drafts_router.post("/{draft_id}/resume", response_model=StartDraftResponse)
async def resume_draft(
    draft_id: uuid.UUID,
    _admin: object = Depends(require_admin),
    service: DraftService = Depends(get_draft_service),
) -> StartDraftResponse:
    """Resume a paused draft session (ADMIN only)."""
    draft = await service.resume_draft(draft_id)
    return StartDraftResponse.from_domain(draft)


@drafts_router.post("/{draft_id}/cancel", response_model=StartDraftResponse)
async def cancel_draft(
    draft_id: uuid.UUID,
    _admin: object = Depends(require_admin),
    service: DraftService = Depends(get_draft_service),
) -> StartDraftResponse:
    """Cancel an active draft session (ADMIN only)."""
    draft = await service.cancel_draft(draft_id)
    return StartDraftResponse.from_domain(draft)
