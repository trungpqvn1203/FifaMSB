"""Integration test: Alembic upgrade + downgrade on real PostgreSQL.

Verifies that migration 0001 can be applied and rolled back cleanly.
"""

import asyncio

import pytest
from testcontainers.community.postgres import PostgresContainer


@pytest.mark.integration
async def test_migration_upgrade_and_downgrade() -> None:
    """Migration 0001 must upgrade to head and downgrade to base without error."""
    from alembic.config import Config as AlembicConfig

    from alembic import command

    with PostgresContainer(image="postgres:16-alpine") as container:
        raw_url = container.get_connection_url()
        async_url = raw_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://").replace(
            "postgresql://", "postgresql+asyncpg://"
        )

        cfg = AlembicConfig("alembic.ini")
        cfg.set_main_option("sqlalchemy.url", async_url)

        # Apply all migrations
        await asyncio.get_event_loop().run_in_executor(None, lambda: command.upgrade(cfg, "head"))

        # Roll back all migrations
        await asyncio.get_event_loop().run_in_executor(None, lambda: command.downgrade(cfg, "base"))

        # Apply again to confirm idempotency
        await asyncio.get_event_loop().run_in_executor(None, lambda: command.upgrade(cfg, "head"))


@pytest.mark.integration
async def test_expected_tables_exist(db_url: str) -> None:
    """After migration, all Phase 1 tables must exist."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(db_url, echo=False)
    expected_tables = {
        "seasons",
        "players",
        "player_seasons",
        "tournaments",
        "teams",
        "users",
        "sessions",
        "draft_sessions",
        "draft_picks",
        "draft_events",
        "matches",
        "match_bans",
    }
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        )
        existing = {row[0] for row in result.fetchall()}

    await engine.dispose()
    missing = expected_tables - existing
    assert not missing, f"Missing tables after migration: {missing}"


@pytest.mark.integration
async def test_gin_index_exists(db_url: str) -> None:
    """The GIN trigram index on players.name must exist after migration."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(db_url, echo=False)
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename = 'players' AND indexname = 'ix_players_name_trgm'"
            )
        )
        row = result.fetchone()

    await engine.dispose()
    assert row is not None, "GIN trgm index ix_players_name_trgm not found"


@pytest.mark.integration
async def test_immutable_unaccent_function_exists(db_url: str) -> None:
    """The immutable_unaccent wrapper function must exist after migration."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(db_url, echo=False)
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT proname FROM pg_proc WHERE proname = 'immutable_unaccent'")
        )
        row = result.fetchone()

    await engine.dispose()
    assert row is not None, "immutable_unaccent function not found"
