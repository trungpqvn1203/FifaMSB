"""End-to-End integration test covering the complete tournament lifecycle.

Flow:
1. Admin authentication & session setup
2. Player search & pool validation
3. Tournament deployment with draft & tactical ban rules
4. Participating teams creation & coordinator account linking
5. Draft session lifecycle: Start -> Live Turn Picks -> Budget & Roster update
6. Match scheduling between drafted teams
7. Tactical ban arena: Start Ban Phase -> Simultaneous Blind Bans -> Lock & Reveal -> Complete Match
"""

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.auth.domain import User
from app.auth.service import AuthService, hash_password
from app.common.clock import SystemClock
from app.draft.domain import DraftEvent, DraftPick, DraftSession
from app.match.domain import Match, MatchBan
from app.player.domain import PlayerSeason
from app.tournament.domain import Team, Tournament


@pytest.mark.integration
async def test_full_tournament_e2e_lifecycle(
    client: AsyncClient,
    db_session: AsyncSession,
    draft_env: dict[str, Any],
) -> None:
    """Run full E2E journey from tournament creation to match completion."""
    clock = SystemClock()
    auth_service = AuthService(session=db_session, clock=clock)

    # --------------------------------------------------------------------------
    # 1. Admin Authentication
    # --------------------------------------------------------------------------
    admin_user = User(
        id=uuid.uuid4(),
        username="e2e_admin",
        password_hash=hash_password("admin_e2e_pass"),
        role="ADMIN",
        team_id=None,
    )
    db_session.add(admin_user)
    await db_session.commit()

    _, admin_token = await auth_service.login("e2e_admin", "admin_e2e_pass")
    client.cookies.set("session_token", admin_token)

    # Verify admin identity
    me_resp = await client.get("/api/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "e2e_admin"
    assert me_resp.json()["role"] == "ADMIN"

    # --------------------------------------------------------------------------
    # 2. Player Search & Catalogue Verification
    # --------------------------------------------------------------------------
    player_seasons_res = await client.get("/api/player-seasons?limit=10")
    assert player_seasons_res.status_code == 200
    player_seasons_data = player_seasons_res.json()
    assert len(player_seasons_data["items"]) > 0

    # Fetch active player seasons with distinct player_id for drafting
    all_active_stmt = (
        select(PlayerSeason)
        .options(joinedload(PlayerSeason.player), joinedload(PlayerSeason.season))
        .where(PlayerSeason.status == "ACTIVE")
    )
    all_cards = list((await db_session.execute(all_active_stmt)).scalars().unique().all())
    seen_player_ids: set[uuid.UUID] = set()
    active_cards = []
    for c in all_cards:
        if c.player_id not in seen_player_ids:
            seen_player_ids.add(c.player_id)
            active_cards.append(c)
        if len(active_cards) == 6:
            break
    assert len(active_cards) >= 6

    # --------------------------------------------------------------------------
    # 3. Create Tournament with Draft and Ban Rules
    # --------------------------------------------------------------------------
    tourney_payload = {
        "name": "E2E Champions Cup 2026",
        "rules": {
            "rulesVersion": 1,
            "rosterSize": 3,
            "budget": 305,
            "pickTimeSeconds": 30,
            "uniqueBy": "PLAYER",
            "timeoutPolicy": "AUTO_PICK_CHEAPEST",
            "allowedSeasonIds": [],
            "banCount": 1,
            "banTimeSeconds": 30,
            "banTarget": "OPPONENT_ROSTER",
            "banOrder": "SIMULTANEOUS",
        },
    }
    create_tourney_resp = await client.post("/api/tournaments", json=tourney_payload)
    assert create_tourney_resp.status_code == 201
    tourney = create_tourney_resp.json()
    tourney_id = tourney["id"]
    assert tourney["name"] == "E2E Champions Cup 2026"

    # --------------------------------------------------------------------------
    # 4. Create Teams & Coordinators
    # --------------------------------------------------------------------------
    t1_resp = await client.post(
        f"/api/tournaments/{tourney_id}/teams",
        json={"name": "Valiant FC", "draftOrder": 1},
    )
    assert t1_resp.status_code == 201
    team1 = t1_resp.json()
    team1_id = team1["id"]

    t2_resp = await client.post(
        f"/api/tournaments/{tourney_id}/teams",
        json={"name": "Titan Esports", "draftOrder": 2},
    )
    assert t2_resp.status_code == 201
    team2 = t2_resp.json()
    team2_id = team2["id"]

    # Register coordinator accounts
    user_t1 = User(
        id=uuid.uuid4(),
        username="coord_valiant",
        password_hash=hash_password("valiant_pass"),
        role="TEAM_USER",
        team_id=uuid.UUID(team1_id),
    )
    user_t2 = User(
        id=uuid.uuid4(),
        username="coord_titan",
        password_hash=hash_password("titan_pass"),
        role="TEAM_USER",
        team_id=uuid.UUID(team2_id),
    )
    db_session.add_all([user_t1, user_t2])
    await db_session.commit()

    _, t1_token = await auth_service.login("coord_valiant", "valiant_pass")
    _, t2_token = await auth_service.login("coord_titan", "titan_pass")

    # --------------------------------------------------------------------------
    # 5. Draft Engine: Start Session & Conduct Picks
    # --------------------------------------------------------------------------
    # Admin starts draft session
    client.cookies.set("session_token", admin_token)
    start_draft_resp = await client.post(f"/api/tournaments/{tourney_id}/draft/start")
    assert start_draft_resp.status_code == 201
    draft_session = start_draft_resp.json()
    draft_id = draft_session["id"]
    assert draft_session["status"] == "PICKING"
    assert draft_session["currentTeamId"] == team1_id
    assert draft_session["currentRound"] == 1

    # Team 1 picks card 0
    client.cookies.set("session_token", t1_token)
    card_0_id = str(active_cards[0].id)
    pick1_resp = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": card_0_id, "expectedVersion": draft_session["version"]},
    )
    assert pick1_resp.status_code == 201
    updated_draft = pick1_resp.json()["nextState"]
    assert updated_draft["currentTeamId"] == team2_id

    # Team 2 picks card 1
    client.cookies.set("session_token", t2_token)
    card_1_id = str(active_cards[1].id)
    pick2_resp = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": card_1_id, "expectedVersion": updated_draft["version"]},
    )
    assert pick2_resp.status_code == 201, pick2_resp.json()
    updated_draft2 = pick2_resp.json()["nextState"]

    # Team 1 picks card 2 (Round 2)
    client.cookies.set("session_token", t1_token)
    card_2_id = str(active_cards[2].id)
    pick3_resp = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": card_2_id, "expectedVersion": updated_draft2["version"]},
    )
    assert pick3_resp.status_code == 201
    updated_draft3 = pick3_resp.json()["nextState"]

    # Team 2 picks card 3
    client.cookies.set("session_token", t2_token)
    card_3_id = str(active_cards[3].id)
    pick4_resp = await client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"playerSeasonId": card_3_id, "expectedVersion": updated_draft3["version"]},
    )
    assert pick4_resp.status_code == 201

    # Verify rosters
    t1_roster_resp = await client.get(f"/api/teams/{team1_id}/roster")
    assert t1_roster_resp.status_code == 200
    assert len(t1_roster_resp.json()["roster"]) == 2

    t2_roster_resp = await client.get(f"/api/teams/{team2_id}/roster")
    assert t2_roster_resp.status_code == 200
    assert len(t2_roster_resp.json()["roster"]) == 2

    # --------------------------------------------------------------------------
    # 6. Match Scheduling
    # --------------------------------------------------------------------------
    client.cookies.set("session_token", admin_token)
    match_payload = {
        "homeTeamId": team1_id,
        "awayTeamId": team2_id,
        "round": "Finals Match 1",
    }
    sched_resp = await client.post(
        f"/api/tournaments/{tourney_id}/matches",
        json=match_payload,
    )
    assert sched_resp.status_code == 201
    match = sched_resp.json()
    match_id = match["id"]
    assert match["status"] == "SCHEDULED"

    # --------------------------------------------------------------------------
    # 7. Tactical Ban Arena: Start Phase & Simultaneous Blind Bans
    # --------------------------------------------------------------------------
    # Admin starts ban phase
    start_ban_resp = await client.post(f"/api/matches/{match_id}/bans/start")
    assert start_ban_resp.status_code == 200
    ban_phase = start_ban_resp.json()
    assert ban_phase["status"] == "BAN_PHASE"

    # Team 1 bans Team 2's card 1
    client.cookies.set("session_token", t1_token)
    t1_ban_resp = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": card_1_id, "targetTeamId": team2_id},
    )
    assert t1_ban_resp.status_code == 201

    # Team 2 inspects bans before submitting: cannot see Team 1's ban details (blind secrecy)
    client.cookies.set("session_token", t2_token)
    t2_view_resp = await client.get(f"/api/matches/{match_id}")
    assert t2_view_resp.status_code == 200
    t2_match_data = t2_view_resp.json()
    # Team 1's ban is not revealed in Team 2's ban list during simultaneous secret phase
    assert len(t2_match_data["bans"]) == 0
    assert t2_match_data["homeTeam"]["banCount"] == 1

    # Team 2 bans Team 1's card 0
    t2_ban_resp = await client.post(
        f"/api/matches/{match_id}/bans",
        json={"playerSeasonId": card_0_id, "targetTeamId": team1_id},
    )
    assert t2_ban_resp.status_code == 201

    # Both teams confirm bans
    client.cookies.set("session_token", t1_token)
    c1_resp = await client.post(f"/api/matches/{match_id}/bans/confirm")
    assert c1_resp.status_code == 200

    client.cookies.set("session_token", t2_token)
    c2_resp = await client.post(f"/api/matches/{match_id}/bans/confirm")
    assert c2_resp.status_code == 200

    # --------------------------------------------------------------------------
    # 8. Post-Ban Reveal & Complete Match
    # --------------------------------------------------------------------------
    # Bans are now locked and revealed to all clients
    revealed_resp = await client.get(f"/api/matches/{match_id}")
    assert revealed_resp.status_code == 200
    revealed_match = revealed_resp.json()
    assert revealed_match["status"] == "BANS_LOCKED"
    revealed_bans = revealed_match["bans"]
    assert len(revealed_bans) == 2
    # Both card IDs are now unmasked
    assert all(b["playerSeasonId"] is not None for b in revealed_bans)

    # Admin completes match
    client.cookies.set("session_token", admin_token)
    complete_resp = await client.post(f"/api/matches/{match_id}/complete")
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "COMPLETED"

    # --------------------------------------------------------------------------
    # Cleanup E2E test records
    # --------------------------------------------------------------------------
    await db_session.execute(delete(MatchBan).where(MatchBan.match_id == uuid.UUID(match_id)))
    await db_session.execute(delete(Match).where(Match.id == uuid.UUID(match_id)))
    await db_session.execute(
        delete(DraftEvent).where(DraftEvent.draft_session_id == uuid.UUID(draft_id))
    )
    await db_session.execute(
        delete(DraftPick).where(DraftPick.draft_session_id == uuid.UUID(draft_id))
    )
    await db_session.execute(delete(DraftSession).where(DraftSession.id == uuid.UUID(draft_id)))
    await db_session.execute(delete(Team).where(Team.tournament_id == uuid.UUID(tourney_id)))
    await db_session.execute(delete(Tournament).where(Tournament.id == uuid.UUID(tourney_id)))
    await db_session.execute(
        delete(User).where(User.username.in_(["e2e_admin", "coord_valiant", "coord_titan"]))
    )
    await db_session.commit()
