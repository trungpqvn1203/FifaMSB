"""Integration tests for Seasons, Player Catalogue, and Admin Import APIs."""

import os
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.domain import User
from app.auth.service import hash_password
from app.common.clock import SystemClock
from app.importer.pipeline import run_import_pipeline
from app.player.domain import PlayerSeason, Season
from app.player.pool_lock import DefaultPoolLockPolicy


@pytest.fixture
async def setup_catalogue_and_users(
    db_session: AsyncSession,
) -> AsyncGenerator[dict[str, Any], None]:
    """Ensure sample players are imported and seed admin and team users cleanly."""
    clock = SystemClock()
    policy = DefaultPoolLockPolicy()

    # Import sample cards if not already present
    cards_count = (await db_session.execute(select(func.count(PlayerSeason.id)))).scalar_one()
    if cards_count < 300:
        csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample_players.csv")
        await run_import_pipeline(
            session=db_session,
            clock=clock,
            pool_lock_policy=policy,
            source=csv_path,
        )

    # Clean up test users first
    await db_session.execute(
        delete(User).where(User.username.in_(["admin_player_test", "team_player_test"]))
    )
    await db_session.commit()

    # Seed users
    admin = User(
        id=uuid.uuid4(),
        username="admin_player_test",
        password_hash=hash_password("admin_pass"),
        role="ADMIN",
        team_id=None,
    )
    team_user = User(
        id=uuid.uuid4(),
        username="team_player_test",
        password_hash=hash_password("team_pass"),
        role="TEAM_USER",
        team_id=None,
    )
    db_session.add_all([admin, team_user])
    await db_session.commit()

    yield {"admin": admin, "team_user": team_user}

    # Clean up after test
    await db_session.execute(
        delete(User).where(User.username.in_(["admin_player_test", "team_player_test"]))
    )
    await db_session.execute(delete(Season).where(Season.code == "25TOTY"))
    await db_session.commit()


@pytest.mark.integration
async def test_get_seasons(client: AsyncClient, setup_catalogue_and_users: dict[str, Any]) -> None:
    """GET /api/seasons returns the list of all seasons."""
    res = await client.get("/api/seasons")
    assert res.status_code == 200
    seasons = res.json()
    assert isinstance(seasons, list)
    assert len(seasons) > 0
    codes = {s["code"] for s in seasons}
    assert "ICON" in codes
    assert "23UCL" in codes


@pytest.mark.integration
async def test_create_season_admin(
    client: AsyncClient, setup_catalogue_and_users: dict[str, Any]
) -> None:
    """POST /api/seasons: ADMIN creates a new season, TEAM_USER is forbidden."""
    # Login as team_user -> 403
    await client.post(
        "/api/auth/login",
        json={"username": "team_player_test", "password": "team_pass"},
    )
    forbidden_res = await client.post(
        "/api/seasons",
        json={"code": "25TOTY", "name": "2025 Team of the Year", "year": 2025},
    )
    assert forbidden_res.status_code == 403

    # Login as admin -> 201
    await client.post(
        "/api/auth/login",
        json={"username": "admin_player_test", "password": "admin_pass"},
    )
    create_res = await client.post(
        "/api/seasons",
        json={"code": "25TOTY", "name": "2025 Team of the Year", "year": 2025},
    )
    assert create_res.status_code == 201
    body = create_res.json()
    assert body["code"] == "25TOTY"
    assert body["name"] == "2025 Team of the Year"


@pytest.mark.integration
async def test_list_player_seasons_pagination_and_filters(
    client: AsyncClient, setup_catalogue_and_users: dict[str, Any]
) -> None:
    """GET /api/player-seasons returns paginated list with totalPages and pageSize."""
    res = await client.get("/api/player-seasons?page=1&pageSize=20")
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 1
    assert data["pageSize"] == 20
    assert data["total"] > 300
    assert data["totalPages"] >= 15
    assert len(data["items"]) == 20

    # Verify item shape
    first = data["items"][0]
    assert "salary" in first
    assert "position" in first
    assert "player" in first
    assert "name" in first["player"]
    assert "season" in first


@pytest.mark.integration
async def test_filter_by_position_group(
    client: AsyncClient, setup_catalogue_and_users: dict[str, Any]
) -> None:
    """Filtering by group=GK returns only goalkeepers; group=FW returns forwards."""
    gk_res = await client.get("/api/player-seasons?group=GK&pageSize=50")
    assert gk_res.status_code == 200
    gk_items = gk_res.json()["items"]
    assert len(gk_items) > 0
    assert all(card["position"] == "GK" for card in gk_items)

    fw_res = await client.get("/api/player-seasons?group=FW&pageSize=50")
    assert fw_res.status_code == 200
    fw_items = fw_res.json()["items"]
    assert len(fw_items) > 0
    valid_fw = {"ST", "CF", "LW", "RW"}
    assert all(card["position"] in valid_fw for card in fw_items)


@pytest.mark.integration
async def test_unaccent_vietnamese_player_search(
    client: AsyncClient, setup_catalogue_and_users: dict[str, Any]
) -> None:
    """Player search is accent-insensitive and matches Vietnamese and accented names."""
    # Searching "quang hai" without tone marks finds "Nguyễn Quang Hải"
    res_qh = await client.get("/api/player-seasons?search=quang hai")
    assert res_qh.status_code == 200
    items_qh = res_qh.json()["items"]
    assert len(items_qh) > 0
    assert any("Nguyễn Quang Hải" in item["player"]["name"] for item in items_qh)

    # Searching "pele" without accent finds "Pelé"
    res_pele = await client.get("/api/player-seasons?search=pele")
    assert res_pele.status_code == 200
    items_pele = res_pele.json()["items"]
    assert len(items_pele) > 0
    assert any("Pelé" in item["player"]["name"] for item in items_pele)

    # Searching "modric" without diacritic finds "Luka Modrić"
    res_modric = await client.get("/api/player-seasons?search=modric")
    assert res_modric.status_code == 200
    items_modric = res_modric.json()["items"]
    assert len(items_modric) > 0
    assert any("Modrić" in item["player"]["name"] for item in items_modric)


@pytest.mark.integration
async def test_get_player_season_detail(
    client: AsyncClient,
    db_session: AsyncSession,
    setup_catalogue_and_users: dict[str, Any],
) -> None:
    """GET /api/player-seasons/{id} returns card detail with player and season."""
    card = (await db_session.execute(select(PlayerSeason))).scalars().first()
    assert card is not None

    res = await client.get(f"/api/player-seasons/{card.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == str(card.id)
    assert body["position"] == card.position
    assert "player" in body
    assert "season" in body

    # Non-existent ID returns 404
    fake_id = str(uuid.uuid4())
    res_404 = await client.get(f"/api/player-seasons/{fake_id}")
    assert res_404.status_code == 404
    assert res_404.json()["code"] == "PLAYER_NOT_FOUND"


@pytest.mark.integration
async def test_patch_salary_admin(
    client: AsyncClient,
    db_session: AsyncSession,
    setup_catalogue_and_users: dict[str, Any],
) -> None:
    """PATCH /api/admin/player-seasons/{id}: ADMIN updates salary; TEAM_USER forbidden."""
    card = (await db_session.execute(select(PlayerSeason))).scalars().first()
    assert card is not None

    # Login as team_user -> 403
    await client.post(
        "/api/auth/login",
        json={"username": "team_player_test", "password": "team_pass"},
    )
    forbid_res = await client.patch(
        f"/api/admin/player-seasons/{card.id}",
        json={"salary": 45},
    )
    assert forbid_res.status_code == 403

    # Login as admin -> 200
    await client.post(
        "/api/auth/login",
        json={"username": "admin_player_test", "password": "admin_pass"},
    )
    patch_res = await client.patch(
        f"/api/admin/player-seasons/{card.id}",
        json={"salary": 45},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["salary"] == 45

    # Re-read from DB
    await db_session.refresh(card)
    assert card.salary == 45


@pytest.mark.integration
async def test_admin_import_csv_endpoint(
    client: AsyncClient,
    setup_catalogue_and_users: dict[str, Any],
) -> None:
    """POST /api/admin/players/import uploads CSV file and returns ImportReport."""
    # Login as admin
    await client.post(
        "/api/auth/login",
        json={"username": "admin_player_test", "password": "admin_pass"},
    )

    csv_data = (
        b"external_player_id,name,season_code,position,salary,rating,image_url\n"
        b"p_ep_test,Test Player,24EP,CF,25,106,\n"
    )
    files = {"file": ("test_import.csv", csv_data, "text/csv")}

    res = await client.post("/api/admin/players/import", files=files)
    assert res.status_code == 200
    report = res.json()
    assert report["rowsRead"] == 1 or report.get("rows_read") == 1
    assert (
        report["rowsInserted"] == 1
        or report["rowsUpdated"] == 1
        or report.get("rows_inserted") == 1
        or report.get("rows_updated") == 1
    )
