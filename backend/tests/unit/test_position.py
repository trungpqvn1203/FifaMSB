"""Unit tests for position definitions and grouping."""

import pytest

from app.player.position import (
    ALL_POSITIONS,
    get_positions_for_group,
    is_valid_position,
    normalize_position,
)


@pytest.mark.unit
def test_all_expected_original_positions_exist() -> None:
    """All FC Online game positions are recognized without collapsing."""
    expected = {
        "ST",
        "CF",
        "LW",
        "RW",
        "CAM",
        "CM",
        "CDM",
        "LM",
        "RM",
        "CB",
        "LB",
        "RB",
        "LWB",
        "RWB",
        "GK",
    }
    assert expected == ALL_POSITIONS


@pytest.mark.unit
def test_position_normalization_and_validation() -> None:
    """normalize_position and is_valid_position work correctly."""
    assert normalize_position(" st ") == "ST"
    assert is_valid_position("ST") is True
    assert is_valid_position("lwb") is True
    assert is_valid_position("GK") is True
    assert is_valid_position("INVALID_POS") is False
    assert is_valid_position("") is False


@pytest.mark.unit
def test_position_groups_mapping() -> None:
    """Position groups FW, MF, DF, GK map to the exact sets of positions."""
    assert get_positions_for_group("FW") == {"ST", "CF", "LW", "RW"}
    assert get_positions_for_group("MF") == {"CDM", "CM", "CAM", "LM", "RM"}
    assert get_positions_for_group("DF") == {"CB", "LB", "RB", "LWB", "RWB"}
    assert get_positions_for_group("GK") == {"GK"}
    assert get_positions_for_group("UNKNOWN") is None
