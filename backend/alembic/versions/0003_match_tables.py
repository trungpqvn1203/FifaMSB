"""0003 — Match and ban tables.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-21

Creates:
  - Tables: matches, match_bans
  - Foreign keys, check constraints, and unique constraints
  - Indexes on tournament_id, status, match_id
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# Revision identifiers
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Table: matches
    # ------------------------------------------------------------------
    op.create_table(
        "matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tournament_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tournaments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "home_team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column(
            "away_team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="SCHEDULED",
            nullable=False,
        ),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "rules_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("ban_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ban_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("home_confirmed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("away_confirmed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("version", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('SCHEDULED', 'BAN_PHASE', 'BANS_LOCKED', 'COMPLETED', 'CANCELLED')",
            name="ck_matches_status",
        ),
        sa.CheckConstraint(
            "home_team_id != away_team_id",
            name="ck_matches_different_teams",
        ),
    )

    op.create_index("ix_matches_tournament_id", "matches", ["tournament_id"])
    op.create_index("ix_matches_status", "matches", ["status"])

    # ------------------------------------------------------------------
    # 2. Table: match_bans
    # ------------------------------------------------------------------
    op.create_table(
        "match_bans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "match_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "banning_team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column(
            "target_team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id"),
            nullable=False,
        ),
        sa.Column(
            "player_season_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("player_seasons.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "match_id",
            "banning_team_id",
            "player_season_id",
            name="uq_match_bans_match_banning_player",
        ),
    )

    op.create_index("ix_match_bans_match_id", "match_bans", ["match_id"])


def downgrade() -> None:
    op.drop_index("ix_match_bans_match_id", table_name="match_bans")
    op.drop_table("match_bans")
    op.drop_index("ix_matches_status", table_name="matches")
    op.drop_index("ix_matches_tournament_id", table_name="matches")
    op.drop_table("matches")
