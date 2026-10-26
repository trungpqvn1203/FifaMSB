"""Unit tests for Draft Engine domain logic — no DB required.

Tests:
- LinearOrder turn rotation & round advancement
- Full roster skipping in turn progression
- Draft completion detection
- is_budget_feasible logic (BR-P11)
"""

import uuid

from app.draft.domain import (
    LinearOrder,
    TeamTurnInfo,
    get_picks_count_for_round,
    is_budget_feasible,
)


def _team(order: int, picked: int = 0, budget_rem: int = 300) -> TeamTurnInfo:
    return TeamTurnInfo(
        team_id=uuid.uuid4(),
        draft_order=order,
        picked_count=picked,
        budget_remaining=budget_rem,
    )


# ---------------------------------------------------------------------------
# LinearOrder Tests
# ---------------------------------------------------------------------------


def test_linear_order_starts_first_team() -> None:
    """When current_team_id is None, start with team with draft_order 1."""
    strategy = LinearOrder()
    t1 = _team(1)
    t2 = _team(2)
    t3 = _team(3)

    res = strategy.next_turn(
        teams=[t2, t1, t3],  # unsorted input
        current_team_id=None,
        current_round=1,
        roster_size=5,
    )
    assert not res.is_completed
    assert res.next_team_id == t1.team_id
    assert res.next_round == 1


def test_linear_order_advances_within_round() -> None:
    """Turn advances from Team 1 -> Team 2 in the same round."""
    strategy = LinearOrder()
    t1 = _team(1)
    t2 = _team(2)
    t3 = _team(3)

    res = strategy.next_turn(
        teams=[t1, t2, t3],
        current_team_id=t1.team_id,
        current_round=1,
        roster_size=5,
    )
    assert not res.is_completed
    assert res.next_team_id == t2.team_id
    assert res.next_round == 1


def test_linear_order_wraps_to_next_round() -> None:
    """After the last team in a round, round increments and wraps to Team 1."""
    strategy = LinearOrder()
    t1 = _team(1, picked=1)
    t2 = _team(2, picked=1)

    res = strategy.next_turn(
        teams=[t1, t2],
        current_team_id=t2.team_id,
        current_round=1,
        roster_size=5,
    )
    assert not res.is_completed
    assert res.next_team_id == t1.team_id
    assert res.next_round == 2


def test_linear_order_skips_full_roster_team_in_round() -> None:
    """Team with full roster is skipped during turn progression."""
    strategy = LinearOrder()
    t1 = _team(1, picked=1)
    t2 = _team(2, picked=5)  # Full roster!
    t3 = _team(3, picked=1)

    res = strategy.next_turn(
        teams=[t1, t2, t3],
        current_team_id=t1.team_id,
        current_round=2,
        roster_size=5,
    )
    assert not res.is_completed
    assert res.next_team_id == t3.team_id  # Skipped t2
    assert res.next_round == 2


def test_linear_order_skips_full_roster_team_on_round_wrap() -> None:
    """When wrapping to new round, full-roster Team 1 is skipped for Team 2."""
    strategy = LinearOrder()
    t1 = _team(1, picked=5)  # Team 1 already completed roster
    t2 = _team(2, picked=4)

    res = strategy.next_turn(
        teams=[t1, t2],
        current_team_id=t2.team_id,
        current_round=5,
        roster_size=5,
    )
    assert not res.is_completed
    assert res.next_team_id == t2.team_id  # Wraps and gives turn to t2
    assert res.next_round == 6


def test_linear_order_completes_when_all_full() -> None:
    """When all teams have full rosters, draft is marked completed."""
    strategy = LinearOrder()
    t1 = _team(1, picked=5)
    t2 = _team(2, picked=5)

    res = strategy.next_turn(
        teams=[t1, t2],
        current_team_id=t2.team_id,
        current_round=5,
        roster_size=5,
    )
    assert res.is_completed
    assert res.next_team_id is None


def test_linear_order_empty_teams_completes() -> None:
    """Empty teams list completes gracefully."""
    strategy = LinearOrder()
    res = strategy.next_turn(
        teams=[],
        current_team_id=None,
        current_round=1,
        roster_size=5,
    )
    assert res.is_completed
    assert res.next_team_id is None


# ---------------------------------------------------------------------------
# Budget Feasibility Tests (BR-P11)
# ---------------------------------------------------------------------------


def test_budget_feasible_last_slot() -> None:
    """When 1 slot left, feasible if salary <= budget_remaining."""
    assert is_budget_feasible(budget_remaining=10, salary=10, slots_left=1)
    assert is_budget_feasible(budget_remaining=10, salary=5, slots_left=1)
    assert not is_budget_feasible(budget_remaining=10, salary=11, slots_left=1)


def test_budget_feasible_multiple_slots() -> None:
    """Leaves enough budget for remaining slots at min_salary."""
    # 2 slots left, min_salary=1: remaining budget after pick must be >= 1
    assert is_budget_feasible(budget_remaining=10, salary=9, slots_left=2, min_salary_in_pool=1)
    assert not is_budget_feasible(
        budget_remaining=10, salary=10, slots_left=2, min_salary_in_pool=1
    )


def test_budget_feasible_high_min_salary() -> None:
    """Leaves enough budget when min_salary is higher."""
    # 3 slots left, min_salary=5: remaining slots = 2 -> need >= 10
    # budget_remaining = 25, salary = 15 -> remaining = 10 -> feasible
    assert is_budget_feasible(budget_remaining=25, salary=15, slots_left=3, min_salary_in_pool=5)
    # budget_remaining = 25, salary = 16 -> remaining = 9 < 10 -> not feasible
    assert not is_budget_feasible(
        budget_remaining=25, salary=16, slots_left=3, min_salary_in_pool=5
    )


def test_budget_feasible_zero_or_negative_slots() -> None:
    """Zero or negative slots left returns False."""
    assert not is_budget_feasible(budget_remaining=10, salary=1, slots_left=0)
    assert not is_budget_feasible(budget_remaining=10, salary=1, slots_left=-1)


# ---------------------------------------------------------------------------
# Pick Count by Round Tests (New Format: 23 players across 11 rounds)
# ---------------------------------------------------------------------------


def test_get_picks_count_for_round() -> None:
    """Verify pick count progression: 3 rounds x 1, 4 rounds x 2, 4 rounds x 3."""
    # Rounds 1-3: 1 starter each
    for r in (1, 2, 3):
        assert get_picks_count_for_round(r) == 1

    # Rounds 4-7: 2 starters each (3 + 8 = 11 starters)
    for r in (4, 5, 6, 7):
        assert get_picks_count_for_round(r) == 2

    # Rounds 8-11: 3 substitutes each (11 + 12 = 23 total roster)
    for r in (8, 9, 10, 11):
        assert get_picks_count_for_round(r) == 3

    # Total cards drafted across 11 rounds must equal 23
    total_picks = sum(get_picks_count_for_round(r) for r in range(1, 12))
    assert total_picks == 23


def test_linear_order_makeup_turn_after_skip() -> None:
    """When a team skips a pick earlier, draft continues to extra round for makeup pick."""
    strategy = LinearOrder()
    # Team 1 skipped 1 pick (has 22 cards after round 11), Team 2 has 23 cards
    t1 = _team(1, picked=22)
    t2 = _team(2, picked=23)

    # At the end of round 11, after Team 2 finished
    res = strategy.next_turn(
        teams=[t1, t2],
        current_team_id=t2.team_id,
        current_round=11,
        roster_size=23,
    )
    # Must NOT complete draft yet; must give makeup turn (Round 12) to Team 1
    assert not res.is_completed
    assert res.next_team_id == t1.team_id
    assert res.next_round == 12

    # After Team 1 picks in round 12 (now has 23 cards)
    t1_completed = _team(1, picked=23)
    res_completed = strategy.next_turn(
        teams=[t1_completed, t2],
        current_team_id=t1.team_id,
        current_round=12,
        roster_size=23,
    )
    # Now all teams have reached 23 cards -> Draft completes!
    assert res_completed.is_completed
    assert res_completed.next_team_id is None

