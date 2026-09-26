"""SQLAlchemy domain models for Tournament and Team, plus TournamentRules validation."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# ---------------------------------------------------------------------------
# TournamentRules — pure Pydantic, no FastAPI, no DB imports
# ---------------------------------------------------------------------------


class TournamentRules(BaseModel):
    """Validated rules for a tournament, stored as JSONB in tournaments.rules.

    All fields have sensible defaults so callers only need to override what they want.
    The model is used both for creating tournaments (input) and reading back (output).
    """

    model_config = ConfigDict(populate_by_name=True)

    rules_version: int = Field(default=1, ge=1)

    # Roster & budget
    roster_size: int = Field(default=24, ge=1, le=60, serialization_alias="rosterSize")
    budget: int = Field(default=305, ge=1)

    # Pick timing
    pick_time_seconds: int = Field(default=30, ge=1, serialization_alias="pickTimeSeconds")

    # Uniqueness rule for picks
    unique_by: Literal["PLAYER", "CARD"] = Field(default="PLAYER", serialization_alias="uniqueBy")

    # What happens when a team's turn timer expires
    timeout_policy: Literal["SKIP_TURN", "AUTO_PICK_CHEAPEST"] = Field(
        default="AUTO_PICK_CHEAPEST", serialization_alias="timeoutPolicy"
    )

    # Which seasons cards may be picked from (empty list = all seasons allowed)
    allowed_season_ids: list[uuid.UUID] = Field(
        default_factory=list, serialization_alias="allowedSeasonIds"
    )

    # Ban phase settings
    ban_count: int = Field(default=5, ge=0, serialization_alias="banCount")
    ban_time_seconds: int = Field(default=60, ge=1, serialization_alias="banTimeSeconds")
    ban_target: Literal["OPPONENT_ROSTER", "OWN_ROSTER"] = Field(
        default="OPPONENT_ROSTER", serialization_alias="banTarget"
    )
    ban_order: Literal["SIMULTANEOUS", "ALTERNATING"] = Field(
        default="SIMULTANEOUS", serialization_alias="banOrder"
    )

    @model_validator(mode="after")
    def _validate_budget_vs_roster(self) -> "TournamentRules":
        """Budget must be large enough to pick at least rosterSize cards at min salary=1."""
        if self.budget < self.roster_size:
            raise ValueError(
                f"budget ({self.budget}) must be >= rosterSize ({self.roster_size}) "
                "because each pick costs at least 1 salary unit."
            )
        return self

    def to_dict(self) -> dict[str, object]:
        """Serialize to plain dict for JSONB storage.

        Uses snake_case keys internally so they round-trip correctly via
        TournamentRules.model_validate(dict).
        """
        return self.model_dump()


def rules_from_dict(data: dict[str, object]) -> TournamentRules:
    """Parse a dict coming from the JSONB column back into a TournamentRules object."""
    return TournamentRules.model_validate(data)


# ---------------------------------------------------------------------------
# Status transition helper — pure Python, no DB access
# ---------------------------------------------------------------------------

# Valid tournament statuses
TOURNAMENT_STATUSES = ("DRAFT", "READY", "RUNNING", "COMPLETED", "CANCELLED")


def compute_tournament_status(current_status: str, team_count: int) -> str:
    """Determine the correct tournament status given the current state and team count.

    Rules:
    - DRAFT → READY automatically when team_count >= 2.
    - READY → DRAFT if teams drop below 2 (shouldn't happen via current API, but defensive).
    - RUNNING, COMPLETED, CANCELLED are terminal states — not changed here.
    """
    if current_status in ("RUNNING", "COMPLETED", "CANCELLED"):
        return current_status
    if team_count >= 2:
        return "READY"
    return "DRAFT"


# ---------------------------------------------------------------------------
# SQLAlchemy ORM models
# ---------------------------------------------------------------------------


class Tournament(Base):
    """A tournament configuration. Rules are stored as validated JSONB."""

    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    # rules JSONB is validated by TournamentRules above before being stored
    rules: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    teams: Mapped[list["Team"]] = relationship(
        "Team",
        back_populates="tournament",
        cascade="all, delete-orphan",
        order_by="Team.draft_order",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT', 'READY', 'RUNNING', 'COMPLETED', 'CANCELLED')",
            name="ck_tournaments_status",
        ),
    )


class Team(Base):
    """A participating team within a tournament.

    draftOrder is 1-based (1..N). A team's roster is its DraftPick rows.
    budget_used is updated atomically on each successful pick.
    """

    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    draft_order: Mapped[int] = mapped_column(Integer, nullable=False)
    budget_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")

    # Relationships
    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="teams")
    # NOTE: User.team_id FK points back here; relationship defined on User side.

    __table_args__ = (
        UniqueConstraint(
            "tournament_id",
            "draft_order",
            name="uq_teams_tournament_id_draft_order",
        ),
        CheckConstraint("budget_used >= 0", name="ck_teams_budget_used_non_negative"),
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE')",
            name="ck_teams_status",
        ),
    )
