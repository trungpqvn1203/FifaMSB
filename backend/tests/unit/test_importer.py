"""Unit tests for CSV ETL importer transform functions."""

import pytest

from app.importer.transform import (
    ValidatedPlayerRow,
    transform_chunk,
    transform_row,
)
from app.player.pool_lock import DefaultPoolLockPolicy


@pytest.mark.unit
def test_transform_valid_row() -> None:
    """A fully populated valid raw row transforms to ValidatedPlayerRow."""
    raw = {
        "external_player_id": "p_1001",
        "name": "Son Heung-min",
        "season_code": "23ucl",
        "position": "lw",
        "salary": "26",
        "rating": "108",
        "image_url": "https://fifa.example.com/son.png",
    }
    row, err = transform_row(raw)
    assert err is None
    assert row is not None
    assert isinstance(row, ValidatedPlayerRow)
    assert row.external_player_id == "p_1001"
    assert row.name == "Son Heung-min"
    assert row.season_code == "23UCL"  # uppercase
    assert row.position == "LW"  # uppercase
    assert row.salary == 26
    assert row.rating == 108
    assert row.image_url == "https://fifa.example.com/son.png"


@pytest.mark.unit
def test_transform_missing_external_player_id_skipped() -> None:
    """Rows without external_player_id are skipped and reported."""
    raw = {
        "external_player_id": "",
        "name": "Anonymous Player",
        "season_code": "ICON",
        "position": "ST",
        "salary": "20",
    }
    row, err = transform_row(raw)
    assert row is None
    assert err is not None
    assert "external_player_id is missing" in err


@pytest.mark.unit
def test_transform_salary_less_than_one_skipped() -> None:
    """Salary must be an integer >= 1; salary 0 or negative is rejected."""
    raw = {
        "external_player_id": "p_1002",
        "name": "Test Player",
        "season_code": "ICON",
        "position": "ST",
        "salary": "0",
    }
    row, err = transform_row(raw)
    assert row is None
    assert err is not None
    assert "Salary must be >= 1" in err or "salary" in err.lower()


@pytest.mark.unit
def test_transform_invalid_position_skipped() -> None:
    """Unknown position strings are rejected."""
    raw = {
        "external_player_id": "p_1003",
        "name": "Test Player",
        "season_code": "ICON",
        "position": "WATER_BOY",
        "salary": "15",
    }
    row, err = transform_row(raw)
    assert row is None
    assert err is not None
    assert "position" in err.lower()


@pytest.mark.unit
def test_transform_chunk_separates_valid_and_errors() -> None:
    """transform_chunk correctly partitions valid records and error messages."""
    records = [
        {
            "external_player_id": "p_valid_1",
            "name": "Gullit",
            "season_code": "ICON",
            "position": "CF",
            "salary": "33",
        },
        {
            "external_player_id": "",  # missing id
            "name": "Invalid",
            "season_code": "ICON",
            "position": "ST",
            "salary": "20",
        },
        {
            "external_player_id": "p_valid_2",
            "name": "Courtois",
            "season_code": "23UCL",
            "position": "GK",
            "salary": "27",
        },
    ]
    valid_rows, errors = transform_chunk(records)
    assert len(valid_rows) == 2
    assert len(errors) == 1
    assert valid_rows[0].name == "Gullit"
    assert valid_rows[1].name == "Courtois"


@pytest.mark.unit
async def test_default_pool_lock_policy_not_locked() -> None:
    """Phase 3 DefaultPoolLockPolicy always returns is_locked() == False."""
    policy = DefaultPoolLockPolicy()
    assert await policy.is_locked() is False
