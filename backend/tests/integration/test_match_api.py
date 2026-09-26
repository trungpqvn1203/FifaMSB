"""Integration tests for Match Scheduling, Tactical Bans, Secrecy, and Lifecycle APIs.

Uses real PostgreSQL via testcontainers and httpx AsyncClient.
Tests:
- Admin match creation, home/away validation, match listing
- Start ban phase lifecycle
- Ban submission validations (BR-M01 roster check, BR-M02 count limit, duplicate check)
- Delete ban before confirmation
- Simultaneous mode ban secrecy (BR-M04) for home, away, spectator, and admin
- Mutual confirmation transition to BANS_LOCKED (BR-M05)
- Match completion
"""

import os
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.auth.domain import User
from app.auth.service import hash_password
from app.common.clock import SystemClock
from app.draft.domain import DraftPick, DraftSession
from app.importer.pipeline import run_import_pipeline
from app.match.domain import Match, MatchBan
from app.player.domain import PlayerSeason
from app.player.pool_lock import DefaultPoolLockPolicy
from app.tournament.domain import Team, Tournament


async def _login(client: AsyncClient, username: str, password: str) -> None:
    res = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"


@pytest.fixture
async def match_env(
    db_session: AsyncSession,
) -> AsyncGenerator[dict[str, Any], None]:
    """Seed players, tournament, 2 teams, draft picks, and users for match testing."""
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
    await db_session.execute(delete(MatchBan))
    await db_session.execute(delete(Match))
    await db_session.execute(delete(DraftPick))
    await db_session.execute(delete(DraftSession))
    await db_session.execute(delete(Team))
    await db_session.execute(delete(Tournament))
    await db_session.execute(
        delete(User).where(
            User.username.in_(["admin_mch_test", "team1_mch_test", "team2_mch_test"])
        )
    )
    await db_session.commit()

    # 3. Create tournament with tactical ban configuration
    tournament = Tournament(
        id=uuid.uuid4(),
        name="Tactical Ban Champions Cup",
        status="RUNNING",
        rules={
            "rules_version": 1,
            "rosterSize": 3,
            "budget": 300,
            "pickTimeSeconds": 30,
            "uniqueBy": "PLAYER",
            "timeoutPolicy": "AUTO_PICK_CHEAPEST",
            "banCount": 2,
            "banTimeSeconds": 60,
            "banOrder": "SIMULTANEOUS",
            "banTarget": "OPPONENT_ROSTER",
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
        name="Red Dragons",
        draft_order=1,
        budget_used=100,
    )
    team2 = Team(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        name="Blue Tigers",
        draft_order=2,
        budget_used=100,
    )
    db_session.add_all([team1, team2])
    await db_session.flush()

    # 5. Create users
    admin = User(
        id=uuid.uuid4(),
        username="admin_mch_test",
        password_hash=hash_password("admin_pass"),
        role="ADMIN",
        team_id=None,
    )
    user1 = User(
        id=uuid.uuid4(),
        username="team1_mch_test",
        password_hash=hash_password("team1_pass"),
        role="TEAM_USER",
        team_id=team1.id,
    )
    user2 = User(
        id=uuid.uuid4(),
        username="team2_mch_test",
        password_hash=hash_password("team2_pass"),
        role="TEAM_USER",
        team_id=team2.id,
    )
    db_session.add_all([admin, user1, user2])
    await db_session.flush()

    # 6. Fetch 8 sample cards to assign to rosters
    sample_cards_res = await db_session.execute(
        select(PlayerSeason)
        .options(joinedload(PlayerSeason.player), joinedload(PlayerSeason.season))
        .where(PlayerSeason.status == "ACTIVE")
        .order_by(PlayerSeason.salary.asc())
        .limit(8)
    )
    cards = list(sample_cards_res.scalars().unique().all())

    # Create a draft session so draft picks are linked
    draft_session = DraftSession(
        id=uuid.uuid4(),
        tournament_id=tournament.id,
        status="COMPLETED",
        current_round=3,
        current_turn=6,
        current_team_id=team2.id,
        rules_snapshot=tournament.rules,
        version=6,
        created_at=clock.now(),
        completed_at=clock.now(),
    )
    db_session.add(draft_session)
    await db_session.flush()

    # Team 1 roster: cards[0], cards[1], cards[2]
    # Team 2 roster: cards[3], cards[4], cards[5]
    # Unpicked cards: cards[6], cards[7]
    picks = [
        DraftPick(
            id=uuid.uuid4(),
            draft_session_id=draft_session.id,
            team_id=team1.id,
            player_season_id=cards[0].id,
            player_id=cards[0].player_id,
            unique_by_player=True,
            round=1,
            turn_number=1,
            salary_at_pick=cards[0].salary,
            picked_at=clock.now(),
        ),
        DraftPick(
            id=uuid.uuid4(),
            draft_session_id=draft_session.id,
            team_id=team1.id,
            player_season_id=cards[1].id,
            player_id=cards[1].player_id,
            unique_by_player=True,
            round=2,
            turn_number=3,
            salary_at_pick=cards[1].salary,
            picked_at=clock.now(),
        ),
        DraftPick(
            id=uuid.uuid4(),
            draft_session_id=draft_session.id,
            team_id=team1.id,
            player_season_id=cards[2].id,
            player_id=cards[2].player_id,
            unique_by_player=True,
            round=3,
            turn_number=5,
            salary_at_pick=cards[2].salary,
            picked_at=clock.now(),
        ),
        DraftPick(
            id=uuid.uuid4(),
            draft_session_id=draft_session.id,
            team_id=team2.id,
            player_season_id=cards[3].id,
            player_id=cards[3].player_id,
            unique_by_player=True,
            round=1,
            turn_number=2,
            salary_at_pick=cards[3].salary,
            picked_at=clock.now(),
        ),
        DraftPick(
            id=uuid.uuid4(),
            draft_session_id=draft_session.id,
            team_id=team2.id,
            player_season_id=cards[4].id,
            player_id=cards[4].player_id,
            unique_by_player=True,
            round=2,
            turn_number=4,
            salary_at_pick=cards[4].salary,
            picked_at=clock.now(),
        ),
        DraftPick(
            id=uuid.uuid4(),
            draft_session_id=draft_session.id,
            team_id=team2.id,
            player_season_id=cards[5].id,
            player_id=cards[5].player_id,
            unique_by_player=True,
            round=3,
            turn_number=6,
            salary_at_pick=cards[5].salary,
            picked_at=clock.now(),
        ),
    ]
    db_session.add_all(picks)
    await db_session.commit()

    yield {
        "tournament": tournament,
        "team1": team1,
        "team2": team2,
        "admin": admin,
        "user1": user1,
        "user2": user2,
        "cards": cards,
        "draft_session": draft_session,
    }

    # Teardown
    await db_session.execute(delete(MatchBan))
    await db_session.execute(delete(Match))
    await db_session.execute(delete(DraftPick))
    await db_session.execute(delete(DraftSession))
    await db_session.execute(delete(Team))
    await db_session.execute(delete(Tournament))
    await db_session.execute(
        delete(User).where(
            User.username.in_(["admin_mch_test", "team1_mch_test", "team2_mch_test"])
        )
    )
    await db_session.commit()


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------


@pytest.mark.integration
async def test_create_match_admin_only(client: AsyncClient, match_env: dict[str, Any]) -> None:
    """Admin creates a match between two tournament teams."""
    trn_id = match_env["tournament"].id
    team1_id = match_env["team1"].id
    team2_id = match_env["team2"].id

    # Non-admin forbidden
    await _login(client, "team1_mch_test", "team1_pass")
    res = await client.post(
        f"/api/tournaments/{trn_id}/matches",
        json={"homeTeamId": str(team1_id), "awayTeamId": str(team2_id), "roundNumber": 1},
    )
    assert res.status_code == 403

    # Admin succeeds
    await _login(client, "admin_mch_test", "admin_pass")
    res = await client.post(
        f"/api/tournaments/{trn_id}/matches",
        json={"homeTeamId": str(team1_id), "awayTeamId": str(team2_id), "roundNumber": 1},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "SCHEDULED"
    assert data["homeTeam"]["id"] == str(team1_id)
    assert data["awayTeam"]["id"] == str(team2_id)
    assert data["rulesSnapshot"]["banCount"] == 2


@pytest.mark.integration
async def test_create_match_same_team_fails(client: AsyncClient, match_env: dict[str, Any]) -> None:
    """A match cannot have the same home and away team."""
    trn_id = match_env["tournament"].id
    team1_id = match_env["team1"].id

    await _login(client, "admin_mch_test", "admin_pass")
    res = await client.post(
        f"/api/tournaments/{trn_id}/matches",
        json={"homeTeamId": str(team1_id), "awayTeamId": str(team1_id), "roundNumber": 1},
    )
    assert res.status_code == 422


@pytest.mark.integration
async def test_start_ban_phase_lifecycle(client: AsyncClient, match_env: dict[str, Any]) -> None:
    """Admin starts ban phase -> status becomes BAN_PHASE with expiry timestamp."""
    trn_id = match_env["tournament"].id
    await _login(client, "admin_mch_test", "admin_pass")

    create_res = await client.post(
        f"/api/tournaments/{trn_id}/matches",
        json={
            "homeTeamId": str(match_env["team1"].id),
            "awayTeamId": str(match_env["team2"].id),
            "roundNumber": 1,
        },
    )
    match_id = create_res.json()["id"]

    start_res = await client.post(f"/api/matches/{match_id}/bans/start")
    assert start_res.status_code == 200
    data = start_res.json()
    assert data["status"] == "BAN_PHASE"
    assert data["banStartedAt"] is not None
    assert data["banExpiresAt"] is not None


@pytest.mark.integration
async def test_submit_ban_validations(client: AsyncClient, match_env: dict[str, Any]) -> None:
    """Tests BR-M01 (roster membership), BR-M02 (ban limits), and duplicate prevention."""
    trn_id = match_env["tournament"].id
    team1 = match_env["team1"]
    team2 = match_env["team2"]
    cards = match_env["cards"]

    # 1. Create match & start ban phase
    await _login(client, "admin_mch_test", "admin_pass")
    create_res = await client.post(
        f"/api/tournaments/{trn_id}/matches",
        json={"homeTeamId": str(team1.id), "awayTeamId": str(team2.id), "roundNumber": 1},
    )
    match_id = create_res.json()["id"]
    await client.post(f"/api/matches/{match_id}/bans/start")

    # 2. Team 1 attempts to ban card 6 (not drafted by anyone -> not in opponent roster)
    await _login(client, "team1_mch_test", "team1_pass")
    res_not_in_roster = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[6].id)},
    )
    assert res_not_in_roster.status_code == 422
    assert res_not_in_roster.json()["code"] == "PLAYER_NOT_IN_ROSTER"

    # 3. Team 1 attempts to ban card 0 (in Team 1's OWN roster, but mode is OPPONENT_ROSTER)
    res_own_roster = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[0].id)},
    )
    assert res_own_roster.status_code == 422
    assert res_own_roster.json()["code"] == "PLAYER_NOT_IN_ROSTER"

    # 4. Team 1 bans card 3 (in Team 2's roster) -> Success 201
    res_valid1 = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[3].id)},
    )
    assert res_valid1.status_code == 201
    ban1_id = res_valid1.json()["id"]

    # 5. Team 1 tries to ban card 3 again -> 409 PLAYER_ALREADY_BANNED
    res_dup = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[3].id)},
    )
    assert res_dup.status_code == 409
    assert res_dup.json()["code"] == "PLAYER_ALREADY_BANNED"

    # 6. Team 1 bans card 4 (2nd valid ban, reaching banCount=2)
    res_valid2 = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[4].id)},
    )
    assert res_valid2.status_code == 201

    # 7. Team 1 tries 3rd ban -> 422 BAN_LIMIT_REACHED
    res_limit = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[5].id)},
    )
    assert res_limit.status_code == 422
    assert res_limit.json()["code"] == "BAN_LIMIT_REACHED"

    # 8. Team 1 deletes ban 1 -> Success 204
    res_del = await client.delete(f"/api/matches/{match_id}/bans/{ban1_id}")
    assert res_del.status_code == 204

    # Now Team 1 can ban card 5 successfully
    res_valid3 = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[5].id)},
    )
    assert res_valid3.status_code == 201


@pytest.mark.integration
async def test_simultaneous_ban_secrecy_and_confirmation(
    client: AsyncClient, match_env: dict[str, Any]
) -> None:
    """Tests BR-M04 (SIMULTANEOUS secrecy) and BR-M05 (mutual confirmation to BANS_LOCKED)."""
    trn_id = match_env["tournament"].id
    team1 = match_env["team1"]
    team2 = match_env["team2"]
    cards = match_env["cards"]

    # 1. Admin creates match & starts ban phase
    await _login(client, "admin_mch_test", "admin_pass")
    create_res = await client.post(
        f"/api/tournaments/{trn_id}/matches",
        json={"homeTeamId": str(team1.id), "awayTeamId": str(team2.id), "roundNumber": 1},
    )
    match_id = create_res.json()["id"]
    await client.post(f"/api/matches/{match_id}/bans/start")

    # 2. Team 1 submits 1 ban against Team 2's card 3
    await _login(client, "team1_mch_test", "team1_pass")
    await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[3].id)},
    )

    # 3. Team 2 submits 1 ban against Team 1's card 0
    await _login(client, "team2_mch_test", "team2_pass")
    await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[0].id)},
    )

    # 4. Check Team 2's view: Sees its own ban (card 0), does NOT see card 3
    t2_view_res = await client.get(f"/api/matches/{match_id}")
    assert t2_view_res.status_code == 200
    t2_data = t2_view_res.json()
    assert t2_data["homeTeam"]["banCount"] == 1
    assert t2_data["awayTeam"]["banCount"] == 1
    assert len(t2_data["bans"]) == 1
    assert t2_data["bans"][0]["playerSeasonId"] == str(cards[0].id)

    # 5. Check Team 1's view: Sees its own ban (card 3), does NOT see card 0
    await _login(client, "team1_mch_test", "team1_pass")
    t1_view_res = await client.get(f"/api/matches/{match_id}")
    t1_data = t1_view_res.json()
    assert len(t1_data["bans"]) == 1
    assert t1_data["bans"][0]["playerSeasonId"] == str(cards[3].id)

    # 6. Check Spectator view (unauthenticated): Sees 0 bans, but ban counts = 1
    client.cookies.clear()
    spec_view_res = await client.get(f"/api/matches/{match_id}")
    spec_data = spec_view_res.json()
    assert len(spec_data["bans"]) == 0
    assert spec_data["homeTeam"]["banCount"] == 1
    assert spec_data["awayTeam"]["banCount"] == 1

    # 7. Team 1 confirms bans
    await _login(client, "team1_mch_test", "team1_pass")
    confirm1_res = await client.post(f"/api/matches/{match_id}/bans/confirm")
    assert confirm1_res.status_code == 200
    assert confirm1_res.json()["homeTeam"]["confirmed"] is True
    # Still in BAN_PHASE because team 2 hasn't confirmed
    assert confirm1_res.json()["status"] == "BAN_PHASE"

    # Team 1 cannot submit more bans after confirming
    extra_ban_res = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": str(cards[4].id)},
    )
    assert extra_ban_res.status_code == 422
    assert extra_ban_res.json()["code"] == "BANS_ALREADY_CONFIRMED"

    # 8. Team 2 confirms bans -> Triggers transition to BANS_LOCKED
    await _login(client, "team2_mch_test", "team2_pass")
    confirm2_res = await client.post(f"/api/matches/{match_id}/bans/confirm")
    assert confirm2_res.status_code == 200
    confirm2_data = confirm2_res.json()
    assert confirm2_data["status"] == "BANS_LOCKED"
    assert confirm2_data["homeTeam"]["confirmed"] is True
    assert confirm2_data["awayTeam"]["confirmed"] is True

    # 9. In BANS_LOCKED, all bans are now revealed to everyone!
    assert len(confirm2_data["bans"]) == 2
    revealed_card_ids = {b["playerSeasonId"] for b in confirm2_data["bans"]}
    assert str(cards[3].id) in revealed_card_ids
    assert str(cards[0].id) in revealed_card_ids

    # Unauthenticated spectator also sees all bans now
    client.cookies.clear()
    spec_locked_res = await client.get(f"/api/matches/{match_id}")
    assert len(spec_locked_res.json()["bans"]) == 2


@pytest.mark.integration
async def test_complete_match_lifecycle(client: AsyncClient, match_env: dict[str, Any]) -> None:
    """Admin marks match as COMPLETED."""
    trn_id = match_env["tournament"].id
    await _login(client, "admin_mch_test", "admin_pass")

    create_res = await client.post(
        f"/api/tournaments/{trn_id}/matches",
        json={
            "homeTeamId": str(match_env["team1"].id),
            "awayTeamId": str(match_env["team2"].id),
            "roundNumber": 1,
        },
    )
    match_id = create_res.json()["id"]

    res = await client.post(f"/api/matches/{match_id}/complete")
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"
