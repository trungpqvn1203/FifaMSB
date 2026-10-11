"""0006 — Allow multi picks per round.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-11

Drops unique constraint uq_draft_picks_session_team_round on draft_picks
to allow teams to select multiple players within the same round (e.g. 2 or 3 picks).
"""

from collections.abc import Sequence

from alembic import op

# Revision identifiers
revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_draft_picks_session_team_round", "draft_picks", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_draft_picks_session_team_round",
        "draft_picks",
        ["draft_session_id", "team_id", "round"],
    )
