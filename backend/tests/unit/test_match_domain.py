"""Unit tests for Match domain models and ban secrecy filtering logic."""

import uuid
from datetime import UTC, datetime

from app.common.clock import FakeClock
from app.match.broadcaster import NoOpMatchBroadcaster
from app.match.domain import Match, MatchBan
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
