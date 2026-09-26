"""0002 — Draft tables.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-21

Creates:
  - Tables: draft_sessions, draft_picks, draft_events
  - Partial unique indexes:
      * uq_draft_sessions_active_tournament (only 1 WAITING/PICKING/PAUSED per tournament)
      * uq_draft_picks_session_player (only 1 pick per player identity when unique_by_player=true)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# Revision identifiers
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Table: draft_sessions
    # ------------------------------------------------------------------
    op.create_table(
        "draft_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tournament_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tournaments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="WAITING"),
        sa.Column("current_round", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("current_turn", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "current_team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("turn_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("turn_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("remaining_millis", sa.BigInteger(), nullable=True),
        sa.Column("rules_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('WAITING', 'PICKING', 'PAUSED', 'COMPLETED', 'CANCELLED')",
            name="ck_draft_sessions_status",
        ),
    )
    op.create_index("ix_draft_sessions_tournament_id", "draft_sessions", ["tournament_id"])

    # BR-T01: Only one active/running draft session per tournament
    op.execute("""
        CREATE UNIQUE INDEX uq_draft_sessions_active_tournament
        ON draft_sessions (tournament_id)
        WHERE status IN ('WAITING', 'PICKING', 'PAUSED')
    """)

    # ------------------------------------------------------------------
    # 2. Table: draft_picks
    # ------------------------------------------------------------------
    op.create_table(
        "draft_picks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "draft_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("draft_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "player_season_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("player_seasons.id"),
            nullable=False,
        ),
        sa.Column(
            "player_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("players.id"),
            nullable=False,
        ),
        sa.Column(
            "unique_by_player",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("turn_number", sa.Integer(), nullable=False),
        sa.Column("salary_at_pick", sa.Integer(), nullable=False),
        sa.Column(
            "picked_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "draft_session_id",
            "player_season_id",
            name="uq_draft_picks_session_player_season",
        ),
        sa.UniqueConstraint(
            "draft_session_id",
            "team_id",
            "round",
            name="uq_draft_picks_session_team_round",
        ),
    )
    op.create_index("ix_draft_picks_team_id", "draft_picks", ["team_id"])
    op.create_index(
        "ix_draft_picks_session_turn",
        "draft_picks",
        ["draft_session_id", "turn_number"],
    )

    # BR-P08: When unique_by_player is TRUE, only one pick per master player
    op.execute("""
        CREATE UNIQUE INDEX uq_draft_picks_session_player
        ON draft_picks (draft_session_id, player_id)
        WHERE unique_by_player = TRUE
    """)

    # ------------------------------------------------------------------
    # 3. Table: draft_events
    # ------------------------------------------------------------------
    op.create_table(
        "draft_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "draft_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("draft_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("turn_number", sa.Integer(), nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "type IN ('START', 'PICK', 'TIMEOUT', 'SKIP', 'PAUSE', 'RESUME', 'COMPLETE', 'CANCEL')",
            name="ck_draft_events_type",
        ),
    )
    op.create_index(
        "ix_draft_events_session_created",
        "draft_events",
        ["draft_session_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("draft_events")
    op.drop_table("draft_picks")
    op.drop_table("draft_sessions")
