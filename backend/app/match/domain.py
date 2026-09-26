"""SQLAlchemy models and pure business domain logic for Matches and Tactical Bans."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

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
