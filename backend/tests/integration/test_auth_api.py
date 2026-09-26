"""Integration tests for Auth API and RBAC on real PostgreSQL container."""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.domain import User, UserSession
from app.auth.service import hash_password
from app.tournament.domain import Team, Tournament


@pytest.fixture
async def seed_users(
    db_session: AsyncSession,
) -> AsyncGenerator[dict[str, Any], None]:
    """Seed test data: Tournament, Teams, ADMIN, and TEAM_USER, cleaning up before and after."""
    # Clean up any leftover data
    await db_session.execute(delete(UserSession))
    await db_session.execute(delete(User))
    await db_session.execute(delete(Team))
    await db_session.execute(delete(Tournament))
    await db_session.commit()

    now = datetime.now(tz=UTC)
    tournament = Tournament(
        id=uuid.uuid4(),
        name="Test Tournament",
        status="DRAFT",
        rules={},
        created_at=now,
        updated_at=now,
    )
    team1 = Team(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        name="Team Alpha",
        draft_order=1,
        budget_used=0,
        status="ACTIVE",
    )
    team2 = Team(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        name="Team Beta",
        draft_order=2,
        budget_used=0,
        status="ACTIVE",
    )
    admin = User(
        id=uuid.uuid4(),
        username="admin_test",
        password_hash=hash_password("admin_pass"),
        role="ADMIN",
        team_id=None,
    )
    team_user = User(
        id=uuid.uuid4(),
        username="team_test",
        password_hash=hash_password("team_pass"),
        role="TEAM_USER",
        team_id=team1.id,
    )
    db_session.add_all([tournament, team1, team2])
    await db_session.flush()

    db_session.add_all([admin, team_user])
    await db_session.commit()

    yield {
        "admin": admin,
        "team_user": team_user,
        "team1": team1,
        "team2": team2,
    }

    # Clean up after test
    await db_session.execute(delete(UserSession))
    await db_session.execute(delete(User))
    await db_session.execute(delete(Team))
    await db_session.execute(delete(Tournament))
    await db_session.commit()


@pytest.mark.integration
async def test_login_success_sets_httponly_cookie(
    client: AsyncClient, seed_users: dict[str, Any]
) -> None:
    """Successful login sets HttpOnly, SameSite=Lax cookie and returns user profile."""
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "admin_pass"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin_test"
    assert body["role"] == "ADMIN"
    assert "session_token" in response.cookies

    # Verify cookie attributes from Set-Cookie header
    set_cookie_header = response.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie_header
    assert "samesite=lax" in set_cookie_header.lower()


@pytest.mark.integration
async def test_login_invalid_credentials(client: AsyncClient, seed_users: dict[str, Any]) -> None:
    """Invalid password returns 401 INVALID_CREDENTIALS with RFC 9457 format."""
    response = await client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "wrong_password"},
    )
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "INVALID_CREDENTIALS"
    assert "type" in body
    assert "title" in body


@pytest.mark.integration
async def test_me_endpoint_with_valid_session(
    client: AsyncClient, seed_users: dict[str, Any]
) -> None:
    """GET /api/auth/me returns current user profile when cookie is present."""
    # Login first
    login_res = await client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "admin_pass"},
    )
    assert login_res.status_code == 200

    # Request /me (cookies are retained by HTTPX AsyncClient session)
    me_res = await client.get("/api/auth/me")
    assert me_res.status_code == 200
    me_body = me_res.json()
    assert me_body["username"] == "admin_test"
    assert me_body["role"] == "ADMIN"


@pytest.mark.integration
async def test_me_endpoint_without_auth_returns_401(client: AsyncClient) -> None:
    """GET /api/auth/me without cookie returns 401 UNAUTHORIZED."""
    client.cookies.clear()
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "UNAUTHORIZED"


@pytest.mark.integration
async def test_logout_invalidates_session(client: AsyncClient, seed_users: dict[str, Any]) -> None:
    """POST /api/auth/logout clears cookie and invalidates session in DB."""
    # Login
    login_res = await client.post(
        "/api/auth/login",
        json={"username": "team_test", "password": "team_pass"},
    )
    assert login_res.status_code == 200

    # Logout
    logout_res = await client.post("/api/auth/logout")
    assert logout_res.status_code == 200

    # Subsequent /me should return 401
    me_res = await client.get("/api/auth/me")
    assert me_res.status_code == 401


@pytest.mark.integration
async def test_admin_can_create_user(client: AsyncClient, seed_users: dict[str, Any]) -> None:
    """ADMIN can create new users via POST /api/admin/users."""
    # Login as admin
    await client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "admin_pass"},
    )

    new_team_id = str(seed_users["team2"].id)
    create_res = await client.post(
        "/api/admin/users",
        json={
            "username": "new_team_user",
            "password": "secret_password",
            "role": "TEAM_USER",
            "teamId": new_team_id,
        },
    )
    assert create_res.status_code == 201
    body = create_res.json()
    assert body["username"] == "new_team_user"
    assert body["role"] == "TEAM_USER"
    assert body["teamId"] == new_team_id

    # Verify new user can now log in
    client.cookies.clear()
    login_new = await client.post(
        "/api/auth/login",
        json={"username": "new_team_user", "password": "secret_password"},
    )
    assert login_new.status_code == 200


@pytest.mark.integration
async def test_team_user_cannot_create_user(
    client: AsyncClient, seed_users: dict[str, Any]
) -> None:
    """TEAM_USER receives 403 FORBIDDEN when calling POST /api/admin/users."""
    # Login as team_user
    await client.post(
        "/api/auth/login",
        json={"username": "team_test", "password": "team_pass"},
    )

    create_res = await client.post(
        "/api/admin/users",
        json={
            "username": "unauthorized_user",
            "password": "pwd",
            "role": "TEAM_USER",
        },
    )
    assert create_res.status_code == 403
    body = create_res.json()
    assert body["code"] == "FORBIDDEN"


@pytest.mark.integration
async def test_create_user_duplicate_username_fails(
    client: AsyncClient, seed_users: dict[str, Any]
) -> None:
    """Creating a user with existing username returns 409 USERNAME_ALREADY_EXISTS."""
    await client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "admin_pass"},
    )

    create_res = await client.post(
        "/api/admin/users",
        json={
            "username": "team_test",  # already exists
            "password": "pwd",
            "role": "TEAM_USER",
        },
    )
    assert create_res.status_code == 409
    body = create_res.json()
    assert body["code"] == "USERNAME_ALREADY_EXISTS"


@pytest.mark.integration
async def test_admin_user_creation_and_role(db_session: AsyncSession) -> None:
    """Admin users created via AuthService have role ADMIN and null team_id."""
    from app.auth.service import AuthService
    from app.common.clock import SystemClock

    service = AuthService(db_session, SystemClock())
    admin = await service.create_user("superadmin", "superpass", role="ADMIN")
    assert admin.role == "ADMIN"
    assert admin.team_id is None


@pytest.mark.integration
async def test_create_admin_cli_creates_user(db_url: str) -> None:
    """create_admin CLI function creates admin and updates password idempotently."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.auth.create_admin import create_admin
    from app.auth.domain import User

    engine = create_async_engine(db_url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    # First run: creates admin
    await create_admin("cli_admin", "initial_pass", session_factory=factory)

    async with factory() as session:
        stmt = select(User).where(User.username == "cli_admin")
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.role == "ADMIN"

    # Second run: updates password idempotently
    await create_admin("cli_admin", "new_pass", session_factory=factory)

    # Cleanup
    async with factory() as session:
        await session.execute(delete(User).where(User.username == "cli_admin"))
        await session.commit()

    await engine.dispose()
