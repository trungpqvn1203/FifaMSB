"""Integration tests for Draft Engine API and business rules.

Uses real PostgreSQL via testcontainers and httpx AsyncClient.
Tests:
- start_draft: requirements (READY status, pool size >= teams * rosterSize), budget reset
- make_pick: successful turn advancement, version increment
- pick concurrency: concurrent picks of same card -> exactly one 201, other 409
- wrong turn (403 NOT_YOUR_TURN)
- uniqueBy=PLAYER rejection across seasons (409 PLAYER_ALREADY_PICKED)
- stale version mismatch (409 DRAFT_VERSION_MISMATCH)
- budget exceeded (422 BUDGET_EXCEEDED) & feasibility (422 BUDGET_INSUFFICIENT_FOR_ROSTER)
- timeout: expired turn auto-picks cheapest valid card and returns 422 TURN_EXPIRED
- pause, resume, cancel lifecycle transitions
- pool lock: PATCH salary returns 422 POOL_LOCKED when draft is active
- get draft picks and team roster endpoints
"""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.draft.domain import DraftSession
from app.player.domain import PlayerSeason


async def _login(client: AsyncClient, username: str, password: str) -> None:
    res = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_start_draft_lifecycle(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """Admin starts draft on READY tournament -> 201 Created with status PICKING."""
    trn_id = draft_env["tournament"].id
    await _login(client, "admin_drf_test", "admin_pass")

    res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "PICKING"
    assert data["currentRound"] == 1
    assert data["currentTurn"] == 1
    assert data["currentTeamId"] == str(draft_env["team1"].id)
    assert data["version"] == 1


@pytest.mark.integration
async def test_start_draft_requires_admin(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """TEAM_USER cannot start a draft -> 403 Forbidden."""
    trn_id = draft_env["tournament"].id
    await _login(client, "team1_drf_test", "team1_pass")

    res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    assert res.status_code == 403


@pytest.mark.integration
async def test_make_pick_turn_advancement(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """Team 1 picks on turn 1 -> advances turn to Team 2 in round 1."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    # Start draft as admin
    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    # Team 1 logs in and picks
    await _login(client, "team1_drf_test", "team1_pass")
    pick_res = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )
    assert pick_res.status_code == 201, pick_res.text
    body = pick_res.json()
    assert body["pick"]["playerSeasonId"] == str(card.id)
    assert body["pick"]["salaryAtPick"] == card.salary
    assert body["nextState"]["currentTurn"] == 2
    assert body["nextState"]["currentRound"] == 1
    assert body["nextState"]["currentTeamId"] == str(draft_env["team2"].id)
    assert body["nextState"]["version"] == 2


@pytest.mark.integration
async def test_make_pick_wrong_turn_rejected(
    client: AsyncClient, draft_env: dict[str, Any]
) -> None:
    """Team 2 attempts to pick on Team 1's turn -> 403 NOT_YOUR_TURN."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    # Team 2 attempts to pick first
    await _login(client, "team2_drf_test", "team2_pass")
    res = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_YOUR_TURN"


@pytest.mark.integration
async def test_make_pick_version_mismatch(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """Sending stale expectedVersion -> 409 DRAFT_VERSION_MISMATCH."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    await _login(client, "team1_drf_test", "team1_pass")
    res = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 99},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "DRAFT_VERSION_MISMATCH"


@pytest.mark.integration
async def test_make_pick_card_already_picked(
    client: AsyncClient, draft_env: dict[str, Any]
) -> None:
    """Attempting to pick a card already drafted -> 409 PLAYER_ALREADY_PICKED."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    # Team 1 picks card
    await _login(client, "team1_drf_test", "team1_pass")
    await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )

    # Team 2 attempts to pick the same card
    await _login(client, "team2_drf_test", "team2_pass")
    res = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 2},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "PLAYER_ALREADY_PICKED"


@pytest.mark.integration
async def test_concurrent_picks_of_same_card(
    client: AsyncClient, draft_env: dict[str, Any]
) -> None:
    """Two concurrent pick requests for the same card: exactly one succeeds, one fails."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    await _login(client, "team1_drf_test", "team1_pass")

    # Send 2 simultaneous requests with same expectedVersion and card
    req1 = client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )
    req2 = client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )
    res1, res2 = await asyncio.gather(req1, req2)

    status_codes = [res1.status_code, res2.status_code]
    assert 201 in status_codes
    # The loser gets either 409 (already picked / version mismatch) or 403 (turn already advanced)
    assert any(code in (409, 403) for code in status_codes)


@pytest.mark.integration
async def test_pause_resume_cancel_flow(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """Pause freezes timer, resume restarts, cancel sets CANCELLED and returns trn to READY."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    # Pause draft
    pause_res = await client.post(f"/api/drafts/{draft_id}/pause")
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "PAUSED"
    assert pause_res.json()["remainingMillis"] is not None

    # Pick while paused -> 422 DRAFT_NOT_ACTIVE
    await _login(client, "team1_drf_test", "team1_pass")
    pick_res = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 2},
    )
    assert pick_res.status_code == 422
    assert pick_res.json()["code"] == "DRAFT_NOT_ACTIVE"

    # Resume draft
    await _login(client, "admin_drf_test", "admin_pass")
    resume_res = await client.post(f"/api/drafts/{draft_id}/resume")
    assert resume_res.status_code == 200
    assert resume_res.json()["status"] == "PICKING"

    # Cancel draft
    cancel_res = await client.post(f"/api/drafts/{draft_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Verify tournament returned to READY
    trn_res = await client.get(f"/api/tournaments/{trn_id}")
    assert trn_res.json()["status"] == "READY"


@pytest.mark.integration
async def test_pool_locked_when_draft_active(
    client: AsyncClient, draft_env: dict[str, Any]
) -> None:
    """PATCH /api/admin/player-seasons/{id} returns 422 POOL_LOCKED when a draft is active."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    await _login(client, "admin_drf_test", "admin_pass")
    await client.post(f"/api/tournaments/{trn_id}/draft/start")

    # While draft is PICKING, try modifying salary
    patch_res = await client.patch(
        f"/api/admin/player-seasons/{card.id}",
        json={"salary": card.salary + 2},
    )
    assert patch_res.status_code == 422, patch_res.text
    assert patch_res.json()["code"] == "POOL_LOCKED"


@pytest.mark.integration
async def test_turn_expired_auto_picks(
    client: AsyncClient, draft_env: dict[str, Any], db_session: AsyncSession
) -> None:
    """When now > turnExpiresAt, pick attempt applies auto-pick, advances turn,
    and returns 422 TURN_EXPIRED.
    """
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = uuid.UUID(start_res.json()["id"])

    # Manually expire the turn in DB
    past = datetime.now().astimezone() - timedelta(seconds=60)
    draft_session = await db_session.get(DraftSession, draft_id)
    assert draft_session is not None
    draft_session.turn_expires_at = past
    await db_session.commit()

    # Team 1 attempts to pick on expired turn
    await _login(client, "team1_drf_test", "team1_pass")
    res = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )
    assert res.status_code == 422
    assert res.json()["code"] == "TURN_EXPIRED"

    # Verify that auto-pick was recorded and turn advanced to Team 2
    detail_res = await client.get(f"/api/drafts/{draft_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["currentTeamId"] == str(draft_env["team2"].id)
    assert detail_res.json()["version"] == 2

    # Verify a pick was inserted for Team 1
    picks_res = await client.get(f"/api/drafts/{draft_id}/picks")
    assert picks_res.status_code == 200
    picks = picks_res.json()
    assert len(picks) == 1
    assert picks[0]["team"]["id"] == str(draft_env["team1"].id)


@pytest.mark.integration
async def test_get_team_roster_endpoint(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """GET /api/teams/{id}/roster returns the drafted cards with player and season info."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]
    team1_id = draft_env["team1"].id

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    await _login(client, "team1_drf_test", "team1_pass")
    await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )

    roster_res = await client.get(f"/api/teams/{team1_id}/roster")
    assert roster_res.status_code == 200, roster_res.text
    data = roster_res.json()
    assert data["rosterCount"] == 1
    assert data["budgetUsed"] == card.salary
    assert len(data["roster"]) == 1
    first_item = data["roster"][0]
    assert first_item["salaryAtPick"] == card.salary
    assert first_item["player"]["name"] == card.player.name
    assert "season" in first_item["player"]


@pytest.mark.integration
async def test_start_draft_pool_too_small(
    client: AsyncClient, draft_env: dict[str, Any], db_session: AsyncSession
) -> None:
    """When pool lacks >= teams * rosterSize active cards, returns 422 DRAFT_POOL_TOO_SMALL."""
    tournament = draft_env["tournament"]
    # Change rosterSize to 500 (2 teams * 500 = 1000 required, pool only has ~379)
    allowed_season_ids: list[str] = []
    tournament.rules = {
        "rules_version": 1,
        "rosterSize": 500,
        "budget": 1000,
        "allowedSeasonIds": allowed_season_ids,
    }
    await db_session.commit()

    await _login(client, "admin_drf_test", "admin_pass")
    res = await client.post(f"/api/tournaments/{tournament.id}/draft/start")
    assert res.status_code == 422, res.text
    assert res.json()["code"] == "DRAFT_POOL_TOO_SMALL"


@pytest.mark.integration
async def test_start_draft_resets_budget_used(
    client: AsyncClient, draft_env: dict[str, Any], db_session: AsyncSession
) -> None:
    """Starting draft resets team.budget_used to 0 for all tournament teams (BR-T02)."""
    trn_id = draft_env["tournament"].id
    team1 = draft_env["team1"]
    team1.budget_used = 75
    await db_session.commit()

    await _login(client, "admin_drf_test", "admin_pass")
    res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    assert res.status_code == 201

    await db_session.refresh(team1)
    assert team1.budget_used == 0


@pytest.mark.integration
async def test_make_pick_unique_by_player(
    client: AsyncClient, draft_env: dict[str, Any], db_session: AsyncSession
) -> None:
    """When uniqueBy=PLAYER, picking different card of same master player returns 409 (BR-P08)."""
    trn_id = draft_env["tournament"].id
    card1 = draft_env["cards"][0]

    # Create a second card for the same player in another season
    from app.player.domain import Season

    season2 = Season(
        id=uuid.uuid4(),
        code="TEST_S2",
        name="Test Season 2",
        created_at=datetime.now(UTC),
    )
    db_session.add(season2)
    await db_session.flush()

    card2 = PlayerSeason(
        id=uuid.uuid4(),
        player_id=card1.player_id,
        season_id=season2.id,
        position=card1.position,
        rating=105,
        salary=15,
        status="ACTIVE",
    )
    db_session.add(card2)
    await db_session.commit()

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    # Team 1 picks card1
    await _login(client, "team1_drf_test", "team1_pass")
    await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card1.id), "expectedVersion": 1},
    )

    # Team 2 attempts to pick card2 (same player_id)
    await _login(client, "team2_drf_test", "team2_pass")
    res = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card2.id), "expectedVersion": 2},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "PLAYER_ALREADY_PICKED"


@pytest.mark.integration
async def test_make_pick_budget_exceeded(
    client: AsyncClient, draft_env: dict[str, Any], db_session: AsyncSession
) -> None:
    """Picking a card exceeding budget cap returns 422 BUDGET_EXCEEDED (BR-P09)."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]
    card.salary = 400  # tournament budget is 305
    await db_session.commit()

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    await _login(client, "team1_drf_test", "team1_pass")
    res = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )
    assert res.status_code == 422
    assert res.json()["code"] == "BUDGET_EXCEEDED"


@pytest.mark.integration
async def test_get_draft_picks_board(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """GET /api/drafts/{id}/picks returns formatted picks for draft board."""
    trn_id = draft_env["tournament"].id
    card = draft_env["cards"][0]

    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    draft_id = start_res.json()["id"]

    await _login(client, "team1_drf_test", "team1_pass")
    await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": str(card.id), "expectedVersion": 1},
    )

    board_res = await client.get(f"/api/drafts/{draft_id}/picks")
    assert board_res.status_code == 200
    picks = board_res.json()
    assert len(picks) == 1
    item = picks[0]
    assert item["round"] == 1
    assert item["turnNumber"] == 1
    assert item["team"]["name"] == "Flash Team 1"
    assert item["player"]["name"] == card.player.name
    assert "season" in item["player"]


@pytest.mark.integration
async def test_get_tournament_draft(client: AsyncClient, draft_env: dict[str, Any]) -> None:
    """GET /api/tournaments/{id}/draft returns 404 before start, 200 with details after start."""
    trn_id = draft_env["tournament"].id

    # Before start -> 404
    res_before = await client.get(f"/api/tournaments/{trn_id}/draft")
    assert res_before.status_code == 404
    assert res_before.json()["code"] == "DRAFT_NOT_FOUND"

    # Start draft
    await _login(client, "admin_drf_test", "admin_pass")
    start_res = await client.post(f"/api/tournaments/{trn_id}/draft/start")
    assert start_res.status_code == 201
    draft_id = start_res.json()["id"]

    # After start -> 200
    res_after = await client.get(f"/api/tournaments/{trn_id}/draft")
    assert res_after.status_code == 200
    data = res_after.json()
    assert data["id"] == draft_id
    assert data["tournamentId"] == str(trn_id)
    assert data["status"] == "PICKING"
    assert len(data["teams"]) == 2
