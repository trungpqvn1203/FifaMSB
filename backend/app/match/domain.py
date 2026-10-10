"""SQLAlchemy models and pure business domain logic for Matches and Tactical Bans."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.player.domain import PlayerSeason
    from app.tournament.domain import Team, Tournament


class Match(Base):
    """Represents a scheduled or played match between two tournament teams."""

    __tablename__ = "matches"

    __table_args__ = (
        CheckConstraint(
            "status IN ('SCHEDULED', 'BAN_PHASE', 'BANS_LOCKED', 'COMPLETED', 'CANCELLED')",
            name="ck_matches_status",
        ),
        CheckConstraint(
            "home_team_id != away_team_id",
            name="ck_matches_different_teams",
        ),
        CheckConstraint(
            "(home_score IS NULL AND away_score IS NULL) OR (home_score >= 0 AND away_score >= 0)",
            name="ck_matches_scores_non_negative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    home_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    away_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="SCHEDULED", server_default="SCHEDULED", index=True
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rules_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    ban_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ban_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    home_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    away_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    tournament: Mapped["Tournament"] = relationship("Tournament")
    home_team: Mapped["Team"] = relationship("Team", foreign_keys=[home_team_id])
    away_team: Mapped["Team"] = relationship("Team", foreign_keys=[away_team_id])
    bans: Mapped[list["MatchBan"]] = relationship(
        "MatchBan",
        back_populates="match",
        cascade="all, delete-orphan",
        order_by="MatchBan.created_at",
    )

    def is_participant(self, team_id: uuid.UUID) -> bool:
        """Return True if team is either home or away team in this match."""
        return self.home_team_id == team_id or self.away_team_id == team_id

    def get_opponent_team_id(self, team_id: uuid.UUID) -> uuid.UUID:
        """Return the opponent team's UUID for a participating team."""
        if team_id == self.home_team_id:
            return self.away_team_id
        if team_id == self.away_team_id:
            return self.home_team_id
        raise ValueError(f"Team {team_id} is not a participant in match {self.id}")

    def is_confirmed(self, team_id: uuid.UUID) -> bool:
        """Return True if the specified participating team has confirmed bans."""
        if team_id == self.home_team_id:
            return self.home_confirmed
        if team_id == self.away_team_id:
            return self.away_confirmed
        return False

    def are_both_confirmed(self) -> bool:
        """Return True if both home and away teams confirmed their bans."""
        return self.home_confirmed and self.away_confirmed

    def is_ban_phase_expired(self, now: datetime) -> bool:
        """Return True if the ban timer has passed now."""
        return self.ban_expires_at is not None and now >= self.ban_expires_at

    def get_bans_for_team(self, team_id: uuid.UUID) -> list["MatchBan"]:
        """Return bans submitted by a specific team."""
        return [b for b in self.bans if b.banning_team_id == team_id]


class MatchBan(Base):
    """Represents a banned player card in a match."""

    __tablename__ = "match_bans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    banning_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    target_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False
    )
    player_season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("player_seasons.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    match: Mapped["Match"] = relationship("Match", back_populates="bans")
    banning_team: Mapped["Team"] = relationship("Team", foreign_keys=[banning_team_id])
    target_team: Mapped["Team"] = relationship("Team", foreign_keys=[target_team_id])
    player_season: Mapped["PlayerSeason"] = relationship("PlayerSeason")


class TeamStanding(BaseModel):
    """Calculated tournament standings entry for a team."""

    model_config = ConfigDict(populate_by_name=True)

    team_id: uuid.UUID = Field(serialization_alias="teamId")
    team_name: str = Field(serialization_alias="teamName")
    draft_order: int = Field(default=1, serialization_alias="draftOrder")
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = Field(default=0, serialization_alias="goalsFor")
    goals_against: int = Field(default=0, serialization_alias="goalsAgainst")
    goal_difference: int = Field(default=0, serialization_alias="goalDifference")
    points: int = 0
    form: list[str] = Field(default_factory=list)


def calculate_standings(teams: list[Any], matches: list[Match]) -> list[TeamStanding]:
    """Calculate tournament standings from teams and completed matches.

    Tie-breaking order:
    1. Points (descending)
    2. Goal Difference (descending)
    3. Goals For (descending)
    4. Draft Order (ascending)
    """
    standings_map: dict[uuid.UUID, TeamStanding] = {
        t.id: TeamStanding(
            team_id=t.id,
            team_name=t.name,
            draft_order=getattr(t, "draft_order", 1),
            played=0,
            won=0,
            drawn=0,
            lost=0,
            goals_for=0,
            goals_against=0,
            goal_difference=0,
            points=0,
            form=[],
        )
        for t in teams
    }

    # Sort matches chronologically
    sorted_matches = sorted(
        [
            m
            for m in matches
            if m.status == "COMPLETED" and m.home_score is not None and m.away_score is not None
        ],
        key=lambda m: m.completed_at or m.created_at,
    )

    for m in sorted_matches:
        assert m.home_score is not None and m.away_score is not None
        h_st = standings_map.get(m.home_team_id)
        a_st = standings_map.get(m.away_team_id)
        if not h_st or not a_st:
            continue

        h_st.played += 1
        a_st.played += 1
        h_st.goals_for += m.home_score
        h_st.goals_against += m.away_score
        h_st.goal_difference = h_st.goals_for - h_st.goals_against

        a_st.goals_for += m.away_score
        a_st.goals_against += m.home_score
        a_st.goal_difference = a_st.goals_for - a_st.goals_against

        if m.home_score > m.away_score:
            h_st.won += 1
            h_st.points += 3
            h_st.form.append("W")
            a_st.lost += 1
            a_st.form.append("L")
        elif m.home_score < m.away_score:
            a_st.won += 1
            a_st.points += 3
            a_st.form.append("W")
            h_st.lost += 1
            h_st.form.append("L")
        else:
            h_st.drawn += 1
            h_st.points += 1
            h_st.form.append("D")
            a_st.drawn += 1
            a_st.points += 1
            a_st.form.append("D")

    def _sort_key(st: TeamStanding) -> tuple[int, int, int, int]:
        return (
            -st.points,
            -st.goal_difference,
            -st.goals_for,
            st.draft_order,
        )

    return sorted(standings_map.values(), key=_sort_key)
