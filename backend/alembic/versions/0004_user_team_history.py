"""0004 — User-team history table.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-02

Creates:
  - Table: user_team_history
    * id (UUID PK)
    * user_id (FK → users.id, CASCADE)
    * team_id (FK → teams.id, SET NULL)  — nullable so history survives team deletion
    * tournament_id (FK → tournaments.id, SET NULL)  — denormalized for quick lookup
    * joined_at (timestamptz)  — when the assignment happened
  - Indexes: ix_user_team_history_user_id, ix_user_team_history_team_id
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# Revision identifiers
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_team_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            # SET NULL so the historical record is preserved even if the team row is deleted
            sa.ForeignKey("teams.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "tournament_id",
            postgresql.UUID(as_uuid=True),
            # Denormalized copy of team.tournament_id — SET NULL on tournament deletion
            sa.ForeignKey("tournaments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("ix_user_team_history_user_id", "user_team_history", ["user_id"])
    op.create_index("ix_user_team_history_team_id", "user_team_history", ["team_id"])


def downgrade() -> None:
    op.drop_index("ix_user_team_history_team_id", table_name="user_team_history")
    op.drop_index("ix_user_team_history_user_id", table_name="user_team_history")
    op.drop_table("user_team_history")
