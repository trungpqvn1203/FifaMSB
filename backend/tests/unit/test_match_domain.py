"""Unit tests for Match domain models and ban secrecy filtering logic."""

import uuid
from datetime import UTC, datetime

from app.common.clock import FakeClock
from app.match.broadcaster import NoOpMatchBroadcaster
from app.match.domain import Match, MatchBan, calculate_standings
from app.match.service import MatchService
from app.player.domain import Player, PlayerSeason, Season
from app.tournament.domain import Team


def _create_mock_match(
    status: str = "BAN_PHASE",
    ban_order: str = "SIMULTANEOUS",
) -> tuple[Match, Team, Team]:
    now = datetime(2026, 9, 21, 12, 0, 0, tzinfo=UTC)
    t_id = uuid.uuid4()
    home = Team(id=uuid.uuid4(), tournament_id=t_id, name="Home Warriors", draft_order=1)
    away = Team(id=uuid.uuid4(), tournament_id=t_id, name="Away Invaders", draft_order=2)

    match = Match(
        id=uuid.uuid4(),
        tournament_id=t_id,
        home_team_id=home.id,
        away_team_id=away.id,
        home_team=home,
        away_team=away,
        status=status,
        scheduled_at=now,
        rules_snapshot={"banCount": 3, "banTimeSeconds": 60, "banOrder": ban_order},
        ban_started_at=now,
        ban_expires_at=datetime(2026, 9, 21, 12, 1, 0, tzinfo=UTC),
        home_confirmed=False,
        away_confirmed=False,
        version=1,
        created_at=now,
        updated_at=now,
        bans=[],
    )
    return match, home, away


def _add_mock_ban(
    match: Match,
    banning_team: Team,
    target_team: Team,
    player_name: str,
    pos: str = "ST",
) -> MatchBan:
    season = Season(id=uuid.uuid4(), code="24TY", name="Team of the Year 2024", game="FC Online")
    player = Player(id=uuid.uuid4(), external_player_id=f"ext-{player_name}", name=player_name)
    ps = PlayerSeason(
        id=uuid.uuid4(),
        player_id=player.id,
        season_id=season.id,
        position=pos,
        rating=95,
        salary=25,
        status="ACTIVE",
        player=player,
        season=season,
    )
    ban = MatchBan(
        id=uuid.uuid4(),
        match_id=match.id,
        banning_team_id=banning_team.id,
        target_team_id=target_team.id,
        player_season_id=ps.id,
        banning_team=banning_team,
        target_team=target_team,
        player_season=ps,
        created_at=match.created_at,
    )
    match.bans.append(ban)
    return ban


def test_match_participant_check() -> None:
    match, home, away = _create_mock_match()
    assert match.is_participant(home.id) is True
    assert match.is_participant(away.id) is True
    assert match.is_participant(uuid.uuid4()) is False


def test_match_get_opponent_team_id() -> None:
    match, home, away = _create_mock_match()
    assert match.get_opponent_team_id(home.id) == away.id
    assert match.get_opponent_team_id(away.id) == home.id


def test_match_timer_expiry() -> None:
    match, _, _ = _create_mock_match()
    before_expire = datetime(2026, 9, 21, 12, 0, 30, tzinfo=UTC)
    after_expire = datetime(2026, 9, 21, 12, 1, 1, tzinfo=UTC)

    assert match.is_ban_phase_expired(before_expire) is False
    assert match.is_ban_phase_expired(after_expire) is True


def test_match_confirmations() -> None:
    match, _, _ = _create_mock_match()
    assert match.are_both_confirmed() is False

    match.home_confirmed = True
    assert match.are_both_confirmed() is False

    match.away_confirmed = True
    assert match.are_both_confirmed() is True


def test_simultaneous_ban_secrecy_filtering() -> None:
    """In SIMULTANEOUS mode during BAN_PHASE, each team sees only its own bans, not opponent's."""
    match, home, away = _create_mock_match(status="BAN_PHASE", ban_order="SIMULTANEOUS")
    _add_mock_ban(match, home, away, "Kylian Mbappé")
    _add_mock_ban(match, away, home, "Erling Haaland")

    clock = FakeClock(match.created_at)
    service = MatchService(session=None, clock=clock, broadcaster=NoOpMatchBroadcaster())  # type: ignore[arg-type]

    # Home team view
    home_view = service.build_match_view_dict(match, viewer_team_id=home.id)
    assert home_view["homeTeam"]["banCount"] == 1
    assert home_view["awayTeam"]["banCount"] == 1
    assert len(home_view["bans"]) == 1
    assert home_view["bans"][0]["playerName"] == "Kylian Mbappé"

    # Away team view
    away_view = service.build_match_view_dict(match, viewer_team_id=away.id)
    assert len(away_view["bans"]) == 1
    assert away_view["bans"][0]["playerName"] == "Erling Haaland"

    # Spectator view (viewer_team_id = None)
    spectator_view = service.build_match_view_dict(match, viewer_team_id=None)
    assert spectator_view["homeTeam"]["banCount"] == 1
    assert spectator_view["awayTeam"]["banCount"] == 1
    assert len(spectator_view["bans"]) == 0

    # Admin view
    admin_view = service.build_match_view_dict(match, is_admin=True)
    assert len(admin_view["bans"]) == 2


def test_locked_ban_phase_reveals_all_bans() -> None:
    """Once status is BANS_LOCKED, all bans are revealed to everyone."""
    match, home, away = _create_mock_match(status="BANS_LOCKED", ban_order="SIMULTANEOUS")
    _add_mock_ban(match, home, away, "Kylian Mbappé")
    _add_mock_ban(match, away, home, "Erling Haaland")

    clock = FakeClock(match.created_at)
    service = MatchService(session=None, clock=clock, broadcaster=NoOpMatchBroadcaster())  # type: ignore[arg-type]

    spectator_view = service.build_match_view_dict(match, viewer_team_id=None)
    assert len(spectator_view["bans"]) == 2
    banned_names = {b["playerName"] for b in spectator_view["bans"]}
    assert "Kylian Mbappé" in banned_names
    assert "Erling Haaland" in banned_names


def test_calculate_standings_empty_matches() -> None:
    t_id = uuid.uuid4()
    t1 = Team(id=uuid.uuid4(), tournament_id=t_id, name="Alpha", draft_order=1)
    t2 = Team(id=uuid.uuid4(), tournament_id=t_id, name="Beta", draft_order=2)

    standings = calculate_standings([t1, t2], [])
    assert len(standings) == 2
    assert standings[0].team_name == "Alpha"
    assert standings[0].points == 0
    assert standings[0].played == 0
    assert standings[1].team_name == "Beta"


def test_calculate_standings_win_loss_draw() -> None:
    t_id = uuid.uuid4()
    now = datetime(2026, 9, 21, 12, 0, 0, tzinfo=UTC)
    t1 = Team(id=uuid.uuid4(), tournament_id=t_id, name="Team 1", draft_order=1)
    t2 = Team(id=uuid.uuid4(), tournament_id=t_id, name="Team 2", draft_order=2)
    t3 = Team(id=uuid.uuid4(), tournament_id=t_id, name="Team 3", draft_order=3)

    # Match 1: Team 1 (3) - Team 2 (1) -> Team 1 win
    m1 = Match(
        id=uuid.uuid4(),
        tournament_id=t_id,
        home_team_id=t1.id,
        away_team_id=t2.id,
        status="COMPLETED",
        home_score=3,
        away_score=1,
        completed_at=now,
        created_at=now,
    )
    # Match 2: Team 2 (2) - Team 3 (2) -> Draw
    m2 = Match(
        id=uuid.uuid4(),
        tournament_id=t_id,
        home_team_id=t2.id,
        away_team_id=t3.id,
        status="COMPLETED",
        home_score=2,
        away_score=2,
        completed_at=now,
        created_at=now,
    )

    standings = calculate_standings([t1, t2, t3], [m1, m2])
    # Team 1: 1P, 1W, 0D, 0L, 3GF, 1GA, +2GD, 3PTS
    assert standings[0].team_name == "Team 1"
    assert standings[0].points == 3
    assert standings[0].goal_difference == 2
    assert standings[0].form == ["W"]

    # Team 3: 1P, 0W, 1D, 0L, 2GF, 2GA, 0GD, 1PTS
    assert standings[1].team_name == "Team 3"
    assert standings[1].points == 1
    assert standings[1].goal_difference == 0
    assert standings[1].form == ["D"]

    # Team 2: 2P, 0W, 1D, 1L, 3GF, 5GA, -2GD, 1PTS
    assert standings[2].team_name == "Team 2"
    assert standings[2].points == 1
    assert standings[2].goal_difference == -2
    assert standings[2].form == ["L", "D"]


def test_tactical_position_line_mapping() -> None:
    """FW, MF, DF lines map correctly to positions including GK."""
    from app.player.position import get_position_line

    assert get_position_line("ST") == "FW"
    assert get_position_line("CF") == "FW"
    assert get_position_line("LW") == "FW"
    assert get_position_line("RW") == "FW"

    assert get_position_line("CAM") == "MF"
    assert get_position_line("CM") == "MF"
    assert get_position_line("CDM") == "MF"
    assert get_position_line("LM") == "MF"
    assert get_position_line("RM") == "MF"

    assert get_position_line("CB") == "DF"
    assert get_position_line("LB") == "DF"
    assert get_position_line("RB") == "DF"
    assert get_position_line("GK") == "DF"


def test_line_ban_limit_reached_exception() -> None:
    """Test that LineBanLimitReached has 422 status and RFC 9457 structured details."""
    from app.common.errors import LineBanLimitReached

    err = LineBanLimitReached("Tiền đạo", limit=2)
    assert err.http_status == 422
    assert err.code == "LINE_BAN_LIMIT_REACHED"
    assert "tối đa 2 cầu thủ ở tuyến Tiền đạo" in err.message
