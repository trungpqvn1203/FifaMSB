"""Domain models, protocols, and pure business logic for the Draft Engine.

Pure Python logic:
- DraftOrderStrategy & LinearOrder
- is_budget_feasible
- TimeoutPolicy protocols
- SQLAlchemy models: DraftSession, DraftPick, DraftEvent
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from app.player.domain import Player, PlayerSeason
    from app.tournament.domain import Team

from sqlalchemy import (
    BigInteger,
    Boolean,
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
# Value objects & Protocols for Turn Progression
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TeamTurnInfo:
    """Snapshot of a team's status needed for turn progression decisions."""

    team_id: uuid.UUID
    draft_order: int
    picked_count: int
    budget_remaining: int


@dataclass(frozen=True)
class TeamDraftStatusData:
    """Read model for team summary in draft details."""

    id: uuid.UUID
    name: str
    draft_order: int
    budget_used: int
    budget_remaining: int
    picked_count: int


@dataclass(frozen=True)
class TurnAdvanceResult:
    """Outcome of calculating the next turn in a draft."""

    next_team_id: uuid.UUID | None
    next_round: int
    is_completed: bool


class DraftOrderStrategy(Protocol):
    """Protocol for calculating turn order and draft completion."""

    def next_turn(
        self,
        teams: Sequence[TeamTurnInfo],
        current_team_id: uuid.UUID | None,
        current_round: int,
        roster_size: int,
    ) -> TurnAdvanceResult:
        """Determine the next team to pick, the next round, and if the draft has finished."""
        ...


class LinearOrder:
    """Standard linear draft order: Team 1 -> Team 2 -> ... -> Team N each round.

    Skips teams whose rosters are already full (picked_count >= roster_size).
    Advances to next round after the last team in the sequence.
    Completes when all teams reach roster_size.
    """

    def next_turn(
        self,
        teams: Sequence[TeamTurnInfo],
        current_team_id: uuid.UUID | None,
        current_round: int,
        roster_size: int,
    ) -> TurnAdvanceResult:
        if not teams:
            return TurnAdvanceResult(next_team_id=None, next_round=current_round, is_completed=True)

        sorted_teams = sorted(teams, key=lambda t: t.draft_order)

        # Check if all teams have filled their rosters
        if all(t.picked_count >= roster_size for t in sorted_teams):
            return TurnAdvanceResult(next_team_id=None, next_round=current_round, is_completed=True)

        # Find current team index
        current_index = -1
        if current_team_id is not None:
            for idx, team in enumerate(sorted_teams):
                if team.team_id == current_team_id:
                    current_index = idx
                    break

        # 1. Search remaining teams in the current round
        for idx in range(current_index + 1, len(sorted_teams)):
            candidate = sorted_teams[idx]
            if candidate.picked_count < roster_size:
                return TurnAdvanceResult(
                    next_team_id=candidate.team_id,
                    next_round=current_round,
                    is_completed=False,
                )

        # 2. End of round reached -> advance round and check from the start
        next_round = current_round + 1
        for candidate in sorted_teams:
            if candidate.picked_count < roster_size:
                return TurnAdvanceResult(
                    next_team_id=candidate.team_id,
                    next_round=next_round,
                    is_completed=False,
                )

        # If no team needs picks, draft is complete
        return TurnAdvanceResult(next_team_id=None, next_round=current_round, is_completed=True)


# ---------------------------------------------------------------------------
# Budget Feasibility Helper (BR-P11)
# ---------------------------------------------------------------------------


def is_budget_feasible(
    budget_remaining: int,
    salary: int,
    slots_left: int,
    min_salary_in_pool: int = 1,
) -> bool:
    """Check if taking this card leaves enough budget to fill all remaining roster slots.

    BR-P11: budgetRemaining - salary >= (slotsLeft - 1) * minSalaryInPool
    where slotsLeft = rosterSize - currentPickedCount.
    """
    if slots_left <= 0:
        return False
    if salary > budget_remaining:
        return False
    if slots_left == 1:
        return True

    remaining_budget_after_pick = budget_remaining - salary
    required_budget_for_rest = (slots_left - 1) * max(1, min_salary_in_pool)
    return remaining_budget_after_pick >= required_budget_for_rest


# ---------------------------------------------------------------------------
# SQLAlchemy Models
# ---------------------------------------------------------------------------


class DraftSession(Base):
    """Draft session executing the real-time card picking for a tournament."""

    __tablename__ = "draft_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="WAITING",
    )
    current_round: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_turn: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )
    turn_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    turn_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remaining_millis: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    rules_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('WAITING', 'PICKING', 'PAUSED', 'COMPLETED', 'CANCELLED')",
            name="ck_draft_sessions_status",
        ),
    )

    picks: Mapped[list["DraftPick"]] = relationship(
        "DraftPick",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="DraftPick.turn_number",
    )
    events: Mapped[list["DraftEvent"]] = relationship(
        "DraftEvent",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="DraftEvent.created_at",
    )


class DraftPick(Base):
    """An individual player card picked by a team during a draft session."""

    __tablename__ = "draft_picks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    draft_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("draft_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    player_season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("player_seasons.id"),
        nullable=False,
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=False,
    )
    unique_by_player: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    round: Mapped[int] = mapped_column(Integer, nullable=False)
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False)
    salary_at_pick: Mapped[int] = mapped_column(Integer, nullable=False)
    picked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "draft_session_id",
            "player_season_id",
            name="uq_draft_picks_session_player_season",
        ),
        UniqueConstraint(
            "draft_session_id",
            "team_id",
            "round",
            name="uq_draft_picks_session_team_round",
        ),
    )

    session: Mapped["DraftSession"] = relationship("DraftSession", back_populates="picks")
    team: Mapped["Team"] = relationship("Team")  # noqa: F821
    player_season: Mapped["PlayerSeason"] = relationship("PlayerSeason")  # noqa: F821
    player: Mapped["Player"] = relationship("Player")  # noqa: F821


class DraftEvent(Base):
    """Audit log and event stream record for a draft session."""

    __tablename__ = "draft_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    draft_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("draft_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )
    turn_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "type IN ('START', 'PICK', 'TIMEOUT', 'SKIP', 'PAUSE', 'RESUME', 'COMPLETE', 'CANCEL')",
            name="ck_draft_events_type",
        ),
    )

    session: Mapped["DraftSession"] = relationship("DraftSession", back_populates="events")
