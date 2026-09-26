"""0001 — Initial schema.

Revision ID: 0001
Revises: (none)
Create Date: 2026-09-20

Creates:
  - Extensions: pg_trgm, unaccent
  - Immutable wrapper function immutable_unaccent(text)
  - Tables: seasons, players (+ GIN name-search index), player_seasons,
            users, sessions, tournaments, teams

NOTE: draft_sessions, draft_picks, draft_events are Phase 5.
      matches, match_bans are Phase 9.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# Revision identifiers
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. PostgreSQL extensions
    # ------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    # ------------------------------------------------------------------
    # 2. Immutable unaccent wrapper function.
    #
    # WHY: PostgreSQL's built-in unaccent() is STABLE, not IMMUTABLE, so
    # it cannot be used directly inside a functional index.
    # We create an IMMUTABLE wrapper so that Postgres accepts it in a GIN
    # index expression.  This is a well-known PostgreSQL pattern.
    # ------------------------------------------------------------------
    op.execute("""
        CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text
        LANGUAGE sql
        IMMUTABLE
        PARALLEL SAFE
        STRICT
        AS $$
            SELECT unaccent($1)
        $$
    """)

    # ------------------------------------------------------------------
    # 3. Table: seasons
    # ------------------------------------------------------------------
    op.create_table(
        "seasons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("badge_url", sa.String(500), nullable=True),
        sa.Column("game", sa.String(100), nullable=False, server_default="FC Online"),
        sa.Column("year", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("code", name="uq_seasons_code"),
    )

    # ------------------------------------------------------------------
    # 4. Table: players
    # ------------------------------------------------------------------
    op.create_table(
        "players",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("external_player_id", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("external_player_id", name="uq_players_external_player_id"),
    )

    # GIN trigram index for fast player name search with unaccent normalization.
    # Uses immutable_unaccent() so it qualifies as an index expression.
    # This enables: WHERE immutable_unaccent(name) ILIKE immutable_unaccent('%search%')
    op.execute("""
        CREATE INDEX ix_players_name_trgm
        ON players
        USING gin (immutable_unaccent(name) gin_trgm_ops)
    """)

    # ------------------------------------------------------------------
    # 5. Table: player_seasons
    # ------------------------------------------------------------------
    op.create_table(
        "player_seasons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "player_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("players.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "season_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("seasons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.String(10), nullable=False),
        sa.Column("rating", sa.Integer, nullable=True),
        sa.Column("salary", sa.Integer, nullable=False),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("pace", sa.Integer, nullable=True),
        sa.Column("shooting", sa.Integer, nullable=True),
        sa.Column("passing", sa.Integer, nullable=True),
        sa.Column("dribbling", sa.Integer, nullable=True),
        sa.Column("defending", sa.Integer, nullable=True),
        sa.Column("physical", sa.Integer, nullable=True),
        sa.UniqueConstraint(
            "player_id",
            "season_id",
            name="uq_player_seasons_player_id_season_id",
        ),
        sa.CheckConstraint("salary >= 1", name="ck_player_seasons_salary_positive"),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE')",
            name="ck_player_seasons_status",
        ),
    )

    # ------------------------------------------------------------------
    # 6. Table: tournaments
    # ------------------------------------------------------------------
    op.create_table(
        "tournaments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column(
            "rules",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'READY', 'RUNNING', 'COMPLETED', 'CANCELLED')",
            name="ck_tournaments_status",
        ),
    )

    # ------------------------------------------------------------------
    # 7. Table: teams
    # ------------------------------------------------------------------
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tournament_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tournaments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("draft_order", sa.Integer, nullable=False),
        sa.Column("budget_used", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.UniqueConstraint(
            "tournament_id",
            "draft_order",
            name="uq_teams_tournament_id_draft_order",
        ),
        sa.CheckConstraint("budget_used >= 0", name="ck_teams_budget_used_non_negative"),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE')",
            name="ck_teams_status",
        ),
    )

    # ------------------------------------------------------------------
    # 8. Table: users (depends on teams FK)
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.CheckConstraint(
            "role IN ('ADMIN', 'TEAM_USER')",
            name="ck_users_role",
        ),
    )

    # ------------------------------------------------------------------
    # 9. Table: sessions
    # ------------------------------------------------------------------
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    # Index on expires_at to efficiently find and clean up expired sessions
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"])
    # Index on user_id for quick user session lookup
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_table("teams")
    op.drop_table("tournaments")
    op.drop_table("player_seasons")
    op.drop_index("ix_players_name_trgm", table_name="players")
    op.drop_table("players")
    op.drop_table("seasons")

    # Drop the immutable wrapper function
    op.execute("DROP FUNCTION IF EXISTS immutable_unaccent(text)")

    # Drop extensions (only if not used by other apps — safe for dev)
    op.execute("DROP EXTENSION IF EXISTS unaccent")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
