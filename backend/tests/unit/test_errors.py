"""Unit tests for DomainError and all error code classes."""

import pytest

from app.common.errors import (
    BanLimitReached,
    BansAlreadyConfirmed,
    BansLocked,
    BudgetExceeded,
    BudgetInsufficientForRoster,
    DomainError,
    DraftCompleted,
    DraftNotActive,
    DraftNotFound,
    DraftPoolTooSmall,
    MatchNotActive,
    MatchNotFound,
    NotYourTurn,
    PlayerAlreadyPicked,
    PlayerNotAvailable,
    PlayerNotFound,
    PlayerNotInRoster,
    PoolLocked,
    SeasonNotAllowed,
    TeamRosterFull,
    TurnExpired,
)


@pytest.mark.unit
def test_domain_error_is_exception() -> None:
    """DomainError must be a subclass of Exception."""
    err = DomainError(code="TEST", http_status=400, message="test")
    assert isinstance(err, Exception)


@pytest.mark.unit
@pytest.mark.parametrize(
    "error_cls, kwargs, expected_code, expected_status",
    [
        (DraftNotFound, {"draft_id": "abc"}, "DRAFT_NOT_FOUND", 404),
        (DraftNotActive, {}, "DRAFT_NOT_ACTIVE", 422),
        (DraftCompleted, {}, "DRAFT_COMPLETED", 422),
        (NotYourTurn, {}, "NOT_YOUR_TURN", 403),
        (TurnExpired, {}, "TURN_EXPIRED", 422),
        (DraftPoolTooSmall, {"available": 10, "required": 96}, "DRAFT_POOL_TOO_SMALL", 422),
        (PlayerNotFound, {"player_season_id": "abc"}, "PLAYER_NOT_FOUND", 404),
        (PlayerNotAvailable, {}, "PLAYER_NOT_AVAILABLE", 422),
        (SeasonNotAllowed, {}, "SEASON_NOT_ALLOWED", 422),
        (PlayerAlreadyPicked, {}, "PLAYER_ALREADY_PICKED", 409),
        (BudgetExceeded, {}, "BUDGET_EXCEEDED", 422),
        (BudgetInsufficientForRoster, {}, "BUDGET_INSUFFICIENT_FOR_ROSTER", 422),
        (TeamRosterFull, {}, "TEAM_ROSTER_FULL", 422),
        (PoolLocked, {}, "POOL_LOCKED", 422),
        (MatchNotFound, {"match_id": "xyz"}, "MATCH_NOT_FOUND", 404),
        (MatchNotActive, {}, "MATCH_NOT_ACTIVE", 422),
        (PlayerNotInRoster, {}, "PLAYER_NOT_IN_ROSTER", 422),
        (BanLimitReached, {"limit": 5}, "BAN_LIMIT_REACHED", 422),
        (BansAlreadyConfirmed, {}, "BANS_ALREADY_CONFIRMED", 422),
        (BansLocked, {}, "BANS_LOCKED", 422),
    ],
)
def test_error_code_and_status(
    error_cls: type[DomainError],
    kwargs: dict,
    expected_code: str,
    expected_status: int,
) -> None:
    """Every error class must have correct code and HTTP status."""
    err = error_cls(**kwargs)
    assert err.code == expected_code
    assert err.http_status == expected_status
    assert isinstance(err.message, str)
    assert len(err.message) > 0
