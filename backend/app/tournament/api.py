"""API endpoints and Pydantic schemas for Tournament and Team management."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.common.clock import Clock, get_clock
from app.db import get_session
from app.tournament.domain import Team, Tournament, TournamentRules
from app.tournament.service import TournamentService, get_tournament_service

tournaments_router = APIRouter()
teams_router = APIRouter()


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------


def _get_service(
    session: AsyncSession = Depends(get_session),
    clock: Clock = Depends(get_clock),
) -> TournamentService:
    return get_tournament_service(session=session, clock=clock)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class TournamentRulesSchema(BaseModel):
    """API-facing rules schema. Accepts camelCase or snake_case input, outputs camelCase."""

    model_config = ConfigDict(populate_by_name=True)

    rules_version: int = Field(
        default=1, ge=1, alias="rulesVersion", serialization_alias="rulesVersion"
    )
    roster_size: int = Field(
        default=24, ge=1, le=60, alias="rosterSize", serialization_alias="rosterSize"
    )
    budget: int = Field(default=305, ge=1)
    pick_time_seconds: int = Field(
        default=30, ge=1, alias="pickTimeSeconds", serialization_alias="pickTimeSeconds"
    )
    unique_by: Literal["PLAYER", "CARD"] = Field(
        default="PLAYER", alias="uniqueBy", serialization_alias="uniqueBy"
    )
    timeout_policy: Literal["SKIP_TURN", "AUTO_PICK_CHEAPEST"] = Field(
        default="AUTO_PICK_CHEAPEST",
        alias="timeoutPolicy",
        serialization_alias="timeoutPolicy",
    )
    allowed_season_ids: list[uuid.UUID] = Field(
        default_factory=list,
        alias="allowedSeasonIds",
        serialization_alias="allowedSeasonIds",
    )
    ban_count: int = Field(default=5, ge=0, alias="banCount", serialization_alias="banCount")
    ban_time_seconds: int = Field(
        default=60, ge=1, alias="banTimeSeconds", serialization_alias="banTimeSeconds"
    )
    ban_target: Literal["OPPONENT_ROSTER", "OWN_ROSTER"] = Field(
        default="OPPONENT_ROSTER",
        alias="banTarget",
        serialization_alias="banTarget",
    )
    ban_order: Literal["SIMULTANEOUS", "ALTERNATING"] = Field(
        default="SIMULTANEOUS",
        alias="banOrder",
        serialization_alias="banOrder",
    )

    @model_validator(mode="after")
    def _validate_budget_vs_roster(self) -> "TournamentRulesSchema":
        """Budget must be large enough to pick at least rosterSize cards at min salary=1."""
        if self.budget < self.roster_size:
            raise ValueError(
                f"budget ({self.budget}) must be >= rosterSize ({self.roster_size}) "
                "because each pick costs at least 1 salary unit."
            )
        return self


def _schema_to_domain_rules(schema: TournamentRulesSchema) -> TournamentRules:
    """Convert API schema dict → domain TournamentRules (validates domain-level constraints)."""
    return TournamentRules.model_validate(schema.model_dump())


class CreateTournamentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=200)
    rules: TournamentRulesSchema = Field(default_factory=TournamentRulesSchema)


class TeamSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    name: str
    draft_order: int = Field(serialization_alias="draftOrder")
    budget_used: int = Field(serialization_alias="budgetUsed")
    status: str

    @classmethod
    def from_domain(cls, team: Team) -> "TeamSummary":
        return cls(
            id=team.id,
            name=team.name,
            draft_order=team.draft_order,
            budget_used=team.budget_used,
            status=team.status,
        )


class TournamentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    name: str
    status: str
    rules: TournamentRulesSchema
    teams: list[TeamSummary]
    created_at: str = Field(serialization_alias="createdAt")
    updated_at: str = Field(serialization_alias="updatedAt")

    @classmethod
    def from_domain(cls, t: Tournament) -> "TournamentResponse":
        return cls(
            id=t.id,
            name=t.name,
            status=t.status,
            rules=TournamentRulesSchema.model_validate(t.rules),
            teams=[TeamSummary.from_domain(team) for team in t.teams],
            created_at=t.created_at.isoformat(),
            updated_at=t.updated_at.isoformat(),
        )


class UpdateTournamentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=200)
    rules: TournamentRulesSchema | None = None


class TournamentListItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    name: str
    status: str
    rules: TournamentRulesSchema | None = None
    team_count: int = Field(serialization_alias="teamCount")
    created_at: str = Field(serialization_alias="createdAt")

    @classmethod
    def from_domain(cls, t: Tournament) -> "TournamentListItem":
        return cls(
            id=t.id,
            name=t.name,
            status=t.status,
            rules=TournamentRulesSchema.model_validate(t.rules) if t.rules else None,
            team_count=len(t.teams),
            created_at=t.created_at.isoformat(),
        )


class CreateTeamRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=200)
    draft_order: int = Field(ge=1, alias="draftOrder", serialization_alias="draftOrder")


class TeamResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    tournament_id: uuid.UUID = Field(serialization_alias="tournamentId")
    name: str
    draft_order: int = Field(serialization_alias="draftOrder")
    budget_used: int = Field(serialization_alias="budgetUsed")
    status: str

    @classmethod
    def from_domain(cls, team: Team) -> "TeamResponse":
        return cls(
            id=team.id,
            tournament_id=team.tournament_id,
            name=team.name,
            draft_order=team.draft_order,
            budget_used=team.budget_used,
            status=team.status,
        )


class RosterSeasonSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    code: str
    name: str
    badge_url: str | None = Field(None, serialization_alias="badgeUrl")


class RosterItemPlayer(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    player_season_id: uuid.UUID = Field(serialization_alias="playerSeasonId")
    player_id: uuid.UUID = Field(serialization_alias="playerId")
    name: str
    position: str
    rating: int | None = None
    salary: int
    season: RosterSeasonSummary


class RosterItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    pick_id: uuid.UUID = Field(serialization_alias="pickId")
    round: int
    turn_number: int = Field(serialization_alias="turnNumber")
    salary_at_pick: int = Field(serialization_alias="salaryAtPick")
    picked_at: str = Field(serialization_alias="pickedAt")
    player: RosterItemPlayer


class RosterResponse(BaseModel):
    """Team roster populated from draft_picks table."""

    model_config = ConfigDict(populate_by_name=True)

    team_id: uuid.UUID = Field(serialization_alias="teamId")
    team_name: str = Field(serialization_alias="teamName")
    roster_count: int = Field(default=0, serialization_alias="rosterCount")
    budget_used: int = Field(serialization_alias="budgetUsed")
    roster: list[RosterItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Tournament endpoints
# ---------------------------------------------------------------------------


@tournaments_router.post("", response_model=TournamentResponse, status_code=201)
async def create_tournament(
    body: CreateTournamentRequest,
    _admin: object = Depends(require_admin),
    service: TournamentService = Depends(_get_service),
) -> TournamentResponse:
    """Create a new tournament with validated TournamentRules (ADMIN only)."""
    domain_rules = _schema_to_domain_rules(body.rules)
    tournament = await service.create_tournament(
        name=body.name,
        rules=domain_rules,
    )
    return TournamentResponse.from_domain(tournament)


@tournaments_router.get("", response_model=list[TournamentListItem])
async def list_tournaments(
    service: TournamentService = Depends(_get_service),
) -> list[TournamentListItem]:
    """List all tournaments (newest first)."""
    tournaments = await service.list_tournaments()
    return [TournamentListItem.from_domain(t) for t in tournaments]


@tournaments_router.get("/{tournament_id}", response_model=TournamentResponse)
async def get_tournament(
    tournament_id: uuid.UUID,
    service: TournamentService = Depends(_get_service),
) -> TournamentResponse:
    """Get tournament details with teams."""
    tournament = await service.get_tournament(tournament_id)
    return TournamentResponse.from_domain(tournament)


@tournaments_router.patch("/{tournament_id}", response_model=TournamentResponse)
@tournaments_router.put("/{tournament_id}", response_model=TournamentResponse)
async def update_tournament(
    tournament_id: uuid.UUID,
    body: UpdateTournamentRequest,
    _admin: object = Depends(require_admin),
    service: TournamentService = Depends(_get_service),
) -> TournamentResponse:
    """Update tournament name and rules (ADMIN only, DRAFT or READY status only)."""
    domain_rules = _schema_to_domain_rules(body.rules) if body.rules is not None else None
    tournament = await service.update_tournament(
        tournament_id=tournament_id,
        name=body.name,
        rules=domain_rules,
    )
    return TournamentResponse.from_domain(tournament)


@tournaments_router.post("/{tournament_id}/complete", response_model=TournamentResponse)
async def complete_tournament(
    tournament_id: uuid.UUID,
    _admin: object = Depends(require_admin),
    service: TournamentService = Depends(_get_service),
) -> TournamentResponse:
    """Manually mark a tournament as COMPLETED (ADMIN only)."""
    tournament = await service.complete_tournament(tournament_id)
    return TournamentResponse.from_domain(tournament)


# ---------------------------------------------------------------------------
# Team endpoints (nested under tournaments)
# ---------------------------------------------------------------------------


@tournaments_router.post("/{tournament_id}/teams", response_model=TeamResponse, status_code=201)
async def add_team(
    tournament_id: uuid.UUID,
    body: CreateTeamRequest,
    _admin: object = Depends(require_admin),
    service: TournamentService = Depends(_get_service),
) -> TeamResponse:
    """Add a team to a tournament (ADMIN only).

    If adding this team makes the count >= 2, tournament transitions DRAFT → READY.
    """
    team = await service.add_team(
        tournament_id=tournament_id,
        name=body.name,
        draft_order=body.draft_order,
    )
    return TeamResponse.from_domain(team)


@tournaments_router.get("/{tournament_id}/teams", response_model=list[TeamResponse])
async def list_teams(
    tournament_id: uuid.UUID,
    service: TournamentService = Depends(_get_service),
) -> list[TeamResponse]:
    """List teams in a tournament ordered by draft_order."""
    teams = await service.list_teams(tournament_id)
    return [TeamResponse.from_domain(t) for t in teams]


# ---------------------------------------------------------------------------
# Team detail endpoints (mounted at /api/teams)
# ---------------------------------------------------------------------------


@teams_router.get("/{team_id}/roster", response_model=RosterResponse)
async def get_team_roster(
    team_id: uuid.UUID,
    service: TournamentService = Depends(_get_service),
) -> RosterResponse:
    """Return the team's drafted roster populated from draft_picks table."""
    team, picks = await service.get_team_roster(team_id)
    roster_items: list[RosterItem] = []
    for p in picks:
        season_model = p.player_season.season
        roster_items.append(
            RosterItem(
                pick_id=p.id,
                round=p.round,
                turn_number=p.turn_number,
                salary_at_pick=p.salary_at_pick,
                picked_at=p.picked_at.isoformat(),
                player=RosterItemPlayer(
                    player_season_id=p.player_season.id,
                    player_id=p.player.id,
                    name=p.player.name,
                    position=p.player_season.position,
                    rating=p.player_season.rating,
                    salary=p.salary_at_pick,
                    season=RosterSeasonSummary(
                        id=season_model.id,
                        code=season_model.code,
                        name=season_model.name,
                        badge_url=season_model.badge_url,
                    ),
                ),
            )
        )
    return RosterResponse(
        team_id=team.id,
        team_name=team.name,
        roster_count=len(picks),
        budget_used=team.budget_used,
        roster=roster_items,
    )
