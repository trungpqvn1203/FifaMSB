"""0007 — Add current_banning_team_id to matches for alternating bans.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-11

Adds:
  - Column current_banning_team_id to matches (UUID, nullable, FK to teams.id)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# Revision identifiers
revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column(
            "current_banning_team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("matches", "current_banning_team_id")
