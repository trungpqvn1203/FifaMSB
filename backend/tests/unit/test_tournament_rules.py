"""Unit tests for TournamentRules Pydantic model and tournament status transitions.

These tests have NO database dependency — pure domain logic only.
"""

import uuid

import pytest
from pydantic import ValidationError

from app.tournament.domain import TournamentRules, compute_tournament_status, rules_from_dict

# ---------------------------------------------------------------------------
# TournamentRules defaults
# ---------------------------------------------------------------------------


def test_tournament_rules_defaults() -> None:
    """TournamentRules created with no arguments should use all spec defaults."""
    rules = TournamentRules()
    assert rules.roster_size == 24
    assert rules.budget == 305
    assert rules.pick_time_seconds == 30
    assert rules.unique_by == "PLAYER"
    assert rules.timeout_policy == "AUTO_PICK_CHEAPEST"
    assert rules.allowed_season_ids == []
    assert rules.ban_count == 5
    assert rules.ban_time_seconds == 60
    assert rules.ban_target == "OPPONENT_ROSTER"
    assert rules.ban_order == "SIMULTANEOUS"
    assert rules.rules_version == 1


def test_tournament_rules_custom_values() -> None:
    """Custom values inside valid ranges should be accepted."""
    rules = TournamentRules(
        roster_size=23,
        budget=400,
        unique_by="CARD",
        timeout_policy="SKIP_TURN",
    )
    assert rules.roster_size == 23
    assert rules.budget == 400
    assert rules.unique_by == "CARD"
    assert rules.timeout_policy == "SKIP_TURN"


def test_tournament_rules_roster_size_min() -> None:
    """roster_size must be >= 1."""
    with pytest.raises(ValidationError):
        TournamentRules.model_validate({"roster_size": 0})


def test_tournament_rules_roster_size_max() -> None:
    """roster_size must be <= 60."""
    with pytest.raises(ValidationError):
        TournamentRules.model_validate({"roster_size": 61})


def test_tournament_rules_invalid_unique_by() -> None:
    """unique_by must be exactly 'PLAYER' or 'CARD'."""
    with pytest.raises(ValidationError):
        TournamentRules(unique_by="BOTH")  # type: ignore[arg-type]


def test_tournament_rules_invalid_timeout_policy() -> None:
    """timeout_policy must be 'SKIP_TURN' or 'AUTO_PICK_CHEAPEST'."""
    with pytest.raises(ValidationError):
        TournamentRules(timeout_policy="RANDOM")  # type: ignore[arg-type]


def test_tournament_rules_invalid_ban_target() -> None:
    """ban_target must be 'OPPONENT_ROSTER' or 'OWN_ROSTER'."""
    with pytest.raises(ValidationError):
        TournamentRules(ban_target="NOBODY")  # type: ignore[arg-type]


def test_tournament_rules_invalid_ban_order() -> None:
    """ban_order must be 'SIMULTANEOUS' or 'ALTERNATING'."""
    with pytest.raises(ValidationError):
        TournamentRules(ban_order="SEQUENTIAL")  # type: ignore[arg-type]


def test_tournament_rules_budget_less_than_roster_size() -> None:
    """budget must be >= rosterSize to allow at least one pick per slot."""
    with pytest.raises(ValidationError):
        TournamentRules(roster_size=30, budget=5)


def test_tournament_rules_allowed_season_ids() -> None:
    """allowed_season_ids can hold UUID values or be empty."""
    season_id = uuid.uuid4()
    rules = TournamentRules(allowed_season_ids=[season_id])
    assert len(rules.allowed_season_ids) == 1
    assert rules.allowed_season_ids[0] == season_id


def test_tournament_rules_to_dict_roundtrip() -> None:
    """Serialise to dict then parse back — result must match original."""
    original = TournamentRules(roster_size=20, budget=200, ban_count=3)
    data = original.to_dict()
    restored = rules_from_dict(data)
    assert restored.roster_size == 20
    assert restored.budget == 200
    assert restored.ban_count == 3


def test_tournament_rules_ban_count_zero() -> None:
    """ban_count = 0 is valid (ban phase disabled)."""
    rules = TournamentRules(ban_count=0)
    assert rules.ban_count == 0


def test_tournament_rules_budget_zero_invalid() -> None:
    """budget must be >= 1."""
    with pytest.raises(ValidationError):
        TournamentRules.model_validate({"budget": 0})


# ---------------------------------------------------------------------------
# compute_tournament_status
# ---------------------------------------------------------------------------


def test_status_stays_draft_with_one_team() -> None:
    assert compute_tournament_status("DRAFT", 1) == "DRAFT"


def test_status_stays_draft_with_zero_teams() -> None:
    assert compute_tournament_status("DRAFT", 0) == "DRAFT"


def test_status_becomes_ready_with_two_teams() -> None:
    assert compute_tournament_status("DRAFT", 2) == "READY"


def test_status_becomes_ready_with_more_teams() -> None:
    assert compute_tournament_status("DRAFT", 8) == "READY"


def test_running_status_unchanged() -> None:
    """Once RUNNING, compute_tournament_status must NOT touch the status."""
    assert compute_tournament_status("RUNNING", 2) == "RUNNING"


def test_completed_status_unchanged() -> None:
    assert compute_tournament_status("COMPLETED", 2) == "COMPLETED"


def test_cancelled_status_unchanged() -> None:
    assert compute_tournament_status("CANCELLED", 0) == "CANCELLED"
