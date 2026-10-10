"""0005 — Match scores and completion timestamp.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-11

Adds:
  - Columns to matches: home_score, away_score, completed_at
  - Check constraint: ck_matches_scores_non_negative
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# Revision identifiers
revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("home_score", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("away_score", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        "ck_matches_scores_non_negative",
        "matches",
        "(home_score IS NULL AND away_score IS NULL) OR (home_score >= 0 AND away_score >= 0)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_matches_scores_non_negative", "matches", type_="check")
    op.drop_column("matches", "completed_at")
    op.drop_column("matches", "away_score")
    op.drop_column("matches", "home_score")
