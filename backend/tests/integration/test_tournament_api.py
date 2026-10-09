"""Integration tests for Tournament and Team Management APIs.

Uses real PostgreSQL via testcontainers. Runs full Alembic migrations.
"""

import uuid
from collections.abc import AsyncGenerator
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.domain import User
from app.auth.service import hash_password
from app.tournament.domain import Team, Tournament

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def tournament_users(
    db_session: AsyncSession,
) -> AsyncGenerator[dict[str, Any], None]:
    """Seed admin + team user for tournament tests."""
    await db_session.execute(
        delete(User).where(User.username.in_(["admin_trn_test", "team_trn_test"]))
    )
    await db_session.commit()

    admin = User(
        id=uuid.uuid4(),
        username="admin_trn_test",
        password_hash=hash_password("admin_pass"),
        role="ADMIN",
        team_id=None,
    )
    team_user = User(
        id=uuid.uuid4(),
        username="team_trn_test",
        password_hash=hash_password("team_pass"),
        role="TEAM_USER",
        team_id=None,
    )
    db_session.add_all([admin, team_user])
    await db_session.commit()

    yield {"admin": admin, "team_user": team_user}

    # Cleanup: delete teams & tournaments created during tests, then users
    await db_session.execute(delete(Team))
    await db_session.execute(delete(Tournament))
    await db_session.execute(
        delete(User).where(User.username.in_(["admin_trn_test", "team_trn_test"]))
    )
    await db_session.commit()


async def _login(client: AsyncClient, username: str, password: str) -> None:
    res = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"


# ---------------------------------------------------------------------------
# Tournament CRUD tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_create_tournament_with_defaults(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """POST /api/tournaments with minimal body creates a tournament with default rules."""
    await _login(client, "admin_trn_test", "admin_pass")
    res = await client.post(
        "/api/tournaments",
        json={"name": "Vietnam FC Online Championship 2026"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Vietnam FC Online Championship 2026"
    assert body["status"] == "DRAFT"
    assert body["rules"]["rosterSize"] == 24
    assert body["rules"]["budget"] == 305
    assert body["rules"]["uniqueBy"] == "PLAYER"
    assert body["rules"]["timeoutPolicy"] == "AUTO_PICK_CHEAPEST"
    assert body["teams"] == []


@pytest.mark.integration
async def test_create_tournament_custom_rules(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """POST /api/tournaments with custom rules stores them correctly."""
    await _login(client, "admin_trn_test", "admin_pass")
    res = await client.post(
        "/api/tournaments",
        json={
            "name": "Mini Cup",
            "rules": {
                "rosterSize": 15,
                "budget": 200,
                "uniqueBy": "CARD",
                "timeoutPolicy": "SKIP_TURN",
                "banCount": 3,
            },
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["rules"]["rosterSize"] == 15
    assert body["rules"]["budget"] == 200
    assert body["rules"]["uniqueBy"] == "CARD"
    assert body["rules"]["banCount"] == 3


@pytest.mark.integration
async def test_create_tournament_invalid_roster_size(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """POST /api/tournaments with rosterSize=0 should return 400 validation error."""
    await _login(client, "admin_trn_test", "admin_pass")
    res = await client.post(
        "/api/tournaments",
        json={"name": "Bad Tournament", "rules": {"rosterSize": 0}},
    )
    assert res.status_code in (400, 422), res.text


@pytest.mark.integration
async def test_create_tournament_invalid_unique_by(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """POST /api/tournaments with invalid uniqueBy should return error."""
    await _login(client, "admin_trn_test", "admin_pass")
    res = await client.post(
        "/api/tournaments",
        json={"name": "Bad Tournament", "rules": {"uniqueBy": "BOTH"}},
    )
    assert res.status_code in (400, 422), res.text


@pytest.mark.integration
async def test_create_tournament_team_user_forbidden(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """TEAM_USER cannot create a tournament."""
    await _login(client, "team_trn_test", "team_pass")
    res = await client.post("/api/tournaments", json={"name": "Forbidden Tournament"})
    assert res.status_code == 403


@pytest.mark.integration
async def test_list_tournaments(client: AsyncClient, tournament_users: dict[str, Any]) -> None:
    """GET /api/tournaments returns a list (may include previously created tournaments)."""
    await _login(client, "admin_trn_test", "admin_pass")
    # Create one to ensure at least one exists
    await client.post("/api/tournaments", json={"name": "List Test Tourney"})
    res = await client.get("/api/tournaments")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    # Items should include at least teamCount and status fields
    first = body[0]
    assert "teamCount" in first
    assert "status" in first


@pytest.mark.integration
async def test_get_tournament_detail(client: AsyncClient, tournament_users: dict[str, Any]) -> None:
    """GET /api/tournaments/{id} returns tournament with teams."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "Detail Test Tourney"})
    tournament_id = create_res.json()["id"]

    res = await client.get(f"/api/tournaments/{tournament_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == tournament_id
    assert body["teams"] == []


@pytest.mark.integration
async def test_get_tournament_not_found(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """GET /api/tournaments/{non-existent-id} returns 404."""
    await _login(client, "admin_trn_test", "admin_pass")
    fake_id = str(uuid.uuid4())
    res = await client.get(f"/api/tournaments/{fake_id}")
    assert res.status_code == 404
    assert res.json()["code"] == "TOURNAMENT_NOT_FOUND"


# ---------------------------------------------------------------------------
# Team tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_add_team_transitions_status(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """Adding 2 teams auto-transitions tournament from DRAFT to READY."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "Status Test Tourney"})
    tournament_id = create_res.json()["id"]

    # Add first team — status should remain DRAFT
    res1 = await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Team Alpha", "draftOrder": 1},
    )
    assert res1.status_code == 201
    detail = (await client.get(f"/api/tournaments/{tournament_id}")).json()
    assert detail["status"] == "DRAFT"

    # Add second team — status should become READY
    res2 = await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Team Beta", "draftOrder": 2},
    )
    assert res2.status_code == 201
    detail = (await client.get(f"/api/tournaments/{tournament_id}")).json()
    assert detail["status"] == "READY"
    assert len(detail["teams"]) == 2


@pytest.mark.integration
async def test_add_team_duplicate_draft_order(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """Adding a team with an already-used draftOrder returns 409."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "Conflict Test Tourney"})
    tournament_id = create_res.json()["id"]

    await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Team A", "draftOrder": 1},
    )
    res = await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Team B", "draftOrder": 1},  # same draft_order
    )
    assert res.status_code == 409
    assert res.json()["code"] == "DRAFT_ORDER_CONFLICT"


@pytest.mark.integration
async def test_add_team_to_nonexistent_tournament(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """Adding a team to a non-existent tournament returns 404."""
    await _login(client, "admin_trn_test", "admin_pass")
    fake_id = str(uuid.uuid4())
    res = await client.post(
        f"/api/tournaments/{fake_id}/teams",
        json={"name": "Ghost Team", "draftOrder": 1},
    )
    assert res.status_code == 404
    assert res.json()["code"] == "TOURNAMENT_NOT_FOUND"


@pytest.mark.integration
async def test_list_teams(client: AsyncClient, tournament_users: dict[str, Any]) -> None:
    """GET /api/tournaments/{id}/teams returns teams ordered by draft_order."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "List Teams Test"})
    tournament_id = create_res.json()["id"]

    await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Team 2", "draftOrder": 2},
    )
    await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Team 1", "draftOrder": 1},
    )

    res = await client.get(f"/api/tournaments/{tournament_id}/teams")
    assert res.status_code == 200
    teams = res.json()
    assert len(teams) == 2
    assert teams[0]["draftOrder"] == 1
    assert teams[1]["draftOrder"] == 2


@pytest.mark.integration
async def test_get_team_roster_empty(client: AsyncClient, tournament_users: dict[str, Any]) -> None:
    """GET /api/teams/{id}/roster returns empty roster in Phase 4 (no picks yet)."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "Roster Test Tourney"})
    tournament_id = create_res.json()["id"]

    team_res = await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Roster Team", "draftOrder": 1},
    )
    team_id = team_res.json()["id"]

    res = await client.get(f"/api/teams/{team_id}/roster")
    assert res.status_code == 200
    body = res.json()
    assert body["teamId"] == team_id
    assert body["rosterCount"] == 0
    assert body["roster"] == []


@pytest.mark.integration
async def test_get_team_roster_not_found(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """GET /api/teams/{non-existent-id}/roster returns 404."""
    await _login(client, "admin_trn_test", "admin_pass")
    fake_id = str(uuid.uuid4())
    res = await client.get(f"/api/teams/{fake_id}/roster")
    assert res.status_code == 404
    assert res.json()["code"] == "TEAM_NOT_FOUND"


# ---------------------------------------------------------------------------
# Complete tournament
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_complete_tournament_admin(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """POST /api/tournaments/{id}/complete (ADMIN) transitions status to COMPLETED."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "Complete Test"})
    tournament_id = create_res.json()["id"]

    res = await client.post(f"/api/tournaments/{tournament_id}/complete")
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"


@pytest.mark.integration
async def test_complete_tournament_forbidden_for_team_user(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """TEAM_USER cannot complete a tournament."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "Forbidden Complete Test"})
    tournament_id = create_res.json()["id"]

    await _login(client, "team_trn_test", "team_pass")
    res = await client.post(f"/api/tournaments/{tournament_id}/complete")
    assert res.status_code == 403


@pytest.mark.integration
async def test_randomize_teams_order(client: AsyncClient, tournament_users: dict[str, Any]) -> None:
    """POST /api/tournaments/{id}/teams/randomize successfully shuffles team draft orders."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "Randomize Test"})
    tournament_id = create_res.json()["id"]

    for i in range(1, 5):
        await client.post(
            f"/api/tournaments/{tournament_id}/teams",
            json={"name": f"Team {i}", "draftOrder": i},
        )

    res = await client.post(f"/api/tournaments/{tournament_id}/teams/randomize")
    assert res.status_code == 200
    teams = res.json()
    assert len(teams) == 4
    orders = [t["draftOrder"] for t in teams]
    assert sorted(orders) == [1, 2, 3, 4]


@pytest.mark.integration
async def test_reorder_teams_locked_when_tournament_not_modifiable(
    client: AsyncClient, tournament_users: dict[str, Any]
) -> None:
    """Cannot reorder or randomize teams when tournament is completed or locked."""
    await _login(client, "admin_trn_test", "admin_pass")
    create_res = await client.post("/api/tournaments", json={"name": "Lock Test Tourney"})
    tournament_id = create_res.json()["id"]

    t1 = await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Team 1", "draftOrder": 1},
    )
    t2 = await client.post(
        f"/api/tournaments/{tournament_id}/teams",
        json={"name": "Team 2", "draftOrder": 2},
    )
    team1_id = t1.json()["id"]
    team2_id = t2.json()["id"]

    # Complete tournament so status becomes COMPLETED
    complete_res = await client.post(f"/api/tournaments/{tournament_id}/complete")
    assert complete_res.status_code == 200

    # Try reorder — should fail with 409
    reorder_res = await client.post(
        f"/api/tournaments/{tournament_id}/teams/reorder",
        json={"teamIds": [team2_id, team1_id]},
    )
    assert reorder_res.status_code == 409

    # Try randomize — should fail with 409
    rand_res = await client.post(f"/api/tournaments/{tournament_id}/teams/randomize")
    assert rand_res.status_code == 409
