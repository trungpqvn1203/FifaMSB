"""Integration tests for the CSV importer pipeline on real PostgreSQL."""

import io
import os

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.clock import SystemClock
from app.common.errors import PoolLocked
from app.draft.domain import DraftEvent, DraftPick, DraftSession
from app.importer.pipeline import run_import_pipeline
from app.player.domain import Player, PlayerSeason, Season
from app.player.pool_lock import DefaultPoolLockPolicy


class AlwaysLockedPolicy:
    """Mock policy that always reports pool is locked."""

    async def is_locked(self) -> bool:
        return True


@pytest.mark.integration
async def test_import_sample_players_csv_pipeline(
    db_session: AsyncSession,
) -> None:
    """Pipeline correctly reads sample CSV, creates seasons, players, and player_seasons."""
    # Ensure fresh state for first-time import test
    await db_session.execute(delete(DraftEvent))
    await db_session.execute(delete(DraftPick))
    await db_session.execute(delete(DraftSession))
    await db_session.execute(delete(PlayerSeason))
    await db_session.execute(delete(Player))
    await db_session.execute(delete(Season))
    await db_session.commit()

    clock = SystemClock()
    policy = DefaultPoolLockPolicy()

    # Find sample_players.csv path
    csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample_players.csv")
    assert os.path.exists(csv_path), f"Sample CSV not found at {csv_path}"

    report = await run_import_pipeline(
        session=db_session,
        clock=clock,
        pool_lock_policy=policy,
        source=csv_path,
        chunk_size=100,
    )

    assert report.rows_read > 300
    assert report.rows_inserted == report.rows_read
    assert report.rows_updated == 0
    assert report.rows_skipped == 0
    assert len(report.errors) == 0

    # Verify seasons were auto-created
    seasons_res = await db_session.execute(select(func.count(Season.id)))
    season_count = seasons_res.scalar_one()
    assert season_count >= 5  # 23UCL, ICON, CAP, LN, BWC, CC, VNM, 24EP

    # Verify player_seasons were created
    cards_res = await db_session.execute(select(func.count(PlayerSeason.id)))
    card_count = cards_res.scalar_one()
    assert card_count == report.rows_inserted


@pytest.mark.integration
async def test_reimport_is_idempotent(db_session: AsyncSession) -> None:
    """Re-importing the same CSV must update existing records without creating duplicates."""
    clock = SystemClock()
    policy = DefaultPoolLockPolicy()
    csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample_players.csv")

    # Initial count of players and cards
    players_before = (await db_session.execute(select(func.count(Player.id)))).scalar_one()
    cards_before = (await db_session.execute(select(func.count(PlayerSeason.id)))).scalar_one()

    report = await run_import_pipeline(
        session=db_session,
        clock=clock,
        pool_lock_policy=policy,
        source=csv_path,
        chunk_size=100,
    )

    # All rows should be updated, 0 inserted
    assert report.rows_inserted == 0
    assert report.rows_updated == report.rows_read

    players_after = (await db_session.execute(select(func.count(Player.id)))).scalar_one()
    cards_after = (await db_session.execute(select(func.count(PlayerSeason.id)))).scalar_one()

    assert players_after == players_before
    assert cards_after == cards_before


@pytest.mark.integration
async def test_import_skips_missing_external_player_id(
    db_session: AsyncSession,
) -> None:
    """Rows missing external_player_id are skipped and reported."""
    clock = SystemClock()
    policy = DefaultPoolLockPolicy()

    csv_content = (
        "external_player_id,name,season_code,position,salary,rating,image_url\n"
        "p_valid_999,Valid Player,ICON,ST,25,105,\n"
        ",Missing ID Player,ICON,CB,20,100,\n"
        "p_valid_998,Another Valid,ICON,GK,15,95,\n"
    )
    buffer = io.StringIO(csv_content)

    report = await run_import_pipeline(
        session=db_session,
        clock=clock,
        pool_lock_policy=policy,
        source=buffer,
    )

    assert report.rows_read == 3
    assert report.rows_inserted == 2
    assert report.rows_skipped == 1
    assert any("external_player_id is missing" in err for err in report.errors)


@pytest.mark.integration
async def test_import_rejected_when_pool_locked(
    db_session: AsyncSession,
) -> None:
    """Import is rejected with PoolLocked if pool is locked."""
    clock = SystemClock()
    locked_policy = AlwaysLockedPolicy()

    csv_content = (
        "external_player_id,name,season_code,position,salary,rating,image_url\n"
        "p_locked,Locked Player,ICON,ST,25,105,\n"
    )
    buffer = io.StringIO(csv_content)

    with pytest.raises(PoolLocked) as exc_info:
        await run_import_pipeline(
            session=db_session,
            clock=clock,
            pool_lock_policy=locked_policy,
            source=buffer,
        )
    assert exc_info.value.code == "POOL_LOCKED"
    assert exc_info.value.http_status == 422
