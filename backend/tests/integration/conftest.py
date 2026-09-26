"""Integration test fixtures — requires Docker for testcontainers.

These fixtures are only loaded when running integration tests.
Unit tests in tests/unit/ do NOT import this file.
"""

import asyncio
from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Use the community module (non-deprecated)
from testcontainers.community.postgres import PostgresContainer


# ---------------------------------------------------------------------------
# PostgreSQL container — session-scoped, started once per test session
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def postgres_container() -> Generator[PostgresContainer, None, None]:
    """Start a real PostgreSQL 16 container for integration tests."""
    with PostgresContainer(image="postgres:16-alpine") as container:
        yield container


@pytest.fixture(scope="session")
def db_url(postgres_container: PostgresContainer) -> str:
    """Return asyncpg connection URL for the test container."""
    url = postgres_container.get_connection_url()
    # Convert psycopg2 style -> asyncpg style
    return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://").replace(
        "postgresql://", "postgresql+asyncpg://"
    )


# ---------------------------------------------------------------------------
# Run Alembic migrations once per session
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
async def run_migrations(db_url: str) -> None:
    """Apply Alembic migrations to the test container DB.

    WHY: We run real Alembic migrations (not create_all) so that the test
    database matches exactly what production will see, including hand-written
    constraints, indexes, and extension setup.
    """
    from alembic.config import Config as AlembicConfig

    from alembic import command

    alembic_cfg = AlembicConfig("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: command.upgrade(alembic_cfg, "head"))


# ---------------------------------------------------------------------------
# Per-test async DB session
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def db_session(db_url: str) -> AsyncGenerator[AsyncSession, None]:
    """Provide a fresh AsyncSession per integration test."""
    engine = create_async_engine(db_url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session
    await engine.dispose()


# ---------------------------------------------------------------------------
# HTTPX AsyncClient for API tests
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def client(db_url: str) -> AsyncGenerator[AsyncClient, None]:
    """Provide an HTTPX AsyncClient wired to the FastAPI app using the test DB."""
    from app.db import get_session, get_session_factory, set_session_factory
    from app.main import app

    test_engine = create_async_engine(db_url, echo=False)
    test_factory = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)
    original_factory = get_session_factory()
    set_session_factory(test_factory)

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with test_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    set_session_factory(original_factory)
    await test_engine.dispose()


# ---------------------------------------------------------------------------
# Shared Draft Environment Fixture
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def draft_env(
    db_session: AsyncSession,
) -> AsyncGenerator[dict[str, Any], None]:
    """Ensure sample player pool exists, create tournament, teams, users, and tokens."""
    import os
    import uuid

    from sqlalchemy import delete, func, select
    from sqlalchemy.orm import joinedload

    from app.auth.domain import User
    from app.auth.service import AuthService, hash_password
    from app.common.clock import SystemClock
    from app.draft.domain import DraftEvent, DraftPick, DraftSession
    from app.importer.pipeline import run_import_pipeline
    from app.player.domain import PlayerSeason
    from app.player.pool_lock import DefaultPoolLockPolicy
    from app.tournament.domain import Team, Tournament

    clock = SystemClock()
    policy = DefaultPoolLockPolicy()

    # 1. Ensure sample player cards are imported
    cards_count = (await db_session.execute(select(func.count(PlayerSeason.id)))).scalar_one()
    if cards_count < 300:
        csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample_players.csv")
        await run_import_pipeline(
            session=db_session,
            clock=clock,
            pool_lock_policy=policy,
            source=csv_path,
        )

    # 2. Cleanup old test data
    await db_session.execute(delete(DraftEvent))
    await db_session.execute(delete(DraftPick))
    await db_session.execute(delete(DraftSession))
    await db_session.execute(delete(Team))
    await db_session.execute(delete(Tournament))
    await db_session.execute(
        delete(User).where(
            User.username.in_(["admin_drf_test", "team1_drf_test", "team2_drf_test"])
        )
    )
    await db_session.commit()

    # 3. Create tournament with small rosterSize for fast testing
    tournament = Tournament(
        id=uuid.uuid4(),
        name="Draft Engine Cup",
        status="READY",
        rules={
            "rules_version": 1,
            "rosterSize": 3,
            "budget": 305,
            "pickTimeSeconds": 30,
            "uniqueBy": "PLAYER",
            "timeoutPolicy": "AUTO_PICK_CHEAPEST",
            "allowedSeasonIds": [],
            "banCount": 0,
        },
        created_at=clock.now(),
        updated_at=clock.now(),
    )
    db_session.add(tournament)
    await db_session.flush()

    # 4. Create 2 teams
    team1 = Team(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        name="Flash Team 1",
        draft_order=1,
        budget_used=0,
    )
    team2 = Team(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        name="Flash Team 2",
        draft_order=2,
        budget_used=0,
    )
    db_session.add_all([team1, team2])
    await db_session.flush()

    # 5. Create users
    admin = User(
        id=uuid.uuid4(),
        username="admin_drf_test",
        password_hash=hash_password("admin_pass"),
        role="ADMIN",
        team_id=None,
    )
    user1 = User(
        id=uuid.uuid4(),
        username="team1_drf_test",
        password_hash=hash_password("team1_pass"),
        role="TEAM_USER",
        team_id=team1.id,
    )
    user2 = User(
        id=uuid.uuid4(),
        username="team2_drf_test",
        password_hash=hash_password("team2_pass"),
        role="TEAM_USER",
        team_id=team2.id,
    )
    db_session.add_all([admin, user1, user2])
    await db_session.commit()

    # Create sessions for tokens
    auth_service = AuthService(session=db_session, clock=clock)
    _, admin_token = await auth_service.login("admin_drf_test", "admin_pass")
    _, user1_token = await auth_service.login("team1_drf_test", "team1_pass")
    _, user2_token = await auth_service.login("team2_drf_test", "team2_pass")

    # Fetch 10 sample cards to use in tests
    sample_cards_res = await db_session.execute(
        select(PlayerSeason)
        .options(joinedload(PlayerSeason.player), joinedload(PlayerSeason.season))
        .where(PlayerSeason.status == "ACTIVE")
        .order_by(PlayerSeason.salary.asc())
        .limit(10)
    )
    cards = list(sample_cards_res.scalars().unique().all())

    yield {
        "tournament": tournament,
        "team1": team1,
        "team2": team2,
        "admin": admin,
        "user1": user1,
        "user2": user2,
        "admin_token": admin_token,
        "user1_token": user1_token,
        "user2_token": user2_token,
        "cards": cards,
    }

    # Teardown
    await db_session.execute(delete(DraftEvent))
    await db_session.execute(delete(DraftPick))
    await db_session.execute(delete(DraftSession))
    await db_session.execute(delete(Team))
    await db_session.execute(delete(Tournament))
    await db_session.execute(
        delete(User).where(
            User.username.in_(["admin_drf_test", "team1_drf_test", "team2_drf_test"])
        )
    )
    await db_session.commit()
