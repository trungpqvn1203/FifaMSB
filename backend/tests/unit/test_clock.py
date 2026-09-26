"""Unit tests for Clock implementations — no DB required."""

from datetime import UTC, datetime, timedelta

import pytest

from app.common.clock import FakeClock, SystemClock


@pytest.mark.unit
def test_system_clock_returns_utc() -> None:
    """SystemClock.now() must return a timezone-aware UTC datetime."""
    clock = SystemClock()
    now = clock.now()
    assert now.tzinfo is not None
    assert now.tzinfo == UTC


@pytest.mark.unit
def test_fake_clock_returns_initial_time() -> None:
    """FakeClock.now() returns exactly the initial datetime."""
    initial = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    clock = FakeClock(initial)
    assert clock.now() == initial


@pytest.mark.unit
def test_fake_clock_advance_seconds() -> None:
    """FakeClock.advance() moves time forward by given seconds."""
    initial = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    clock = FakeClock(initial)
    clock.advance(seconds=30)
    expected = initial + timedelta(seconds=30)
    assert clock.now() == expected


@pytest.mark.unit
def test_fake_clock_advance_minutes() -> None:
    """FakeClock.advance() works with minutes too."""
    initial = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    clock = FakeClock(initial)
    clock.advance(minutes=5)
    expected = initial + timedelta(minutes=5)
    assert clock.now() == expected


@pytest.mark.unit
def test_fake_clock_set() -> None:
    """FakeClock.set() jumps the clock to an arbitrary datetime."""
    initial = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    clock = FakeClock(initial)
    new_time = datetime(2026, 6, 15, 18, 30, 0, tzinfo=UTC)
    clock.set(new_time)
    assert clock.now() == new_time


@pytest.mark.unit
def test_fake_clock_requires_timezone_aware_initial() -> None:
    """FakeClock must reject naive datetimes."""
    naive = datetime(2026, 1, 1, 12, 0, 0)
    with pytest.raises(ValueError, match="timezone-aware"):
        FakeClock(naive)


@pytest.mark.unit
def test_fake_clock_set_requires_timezone_aware() -> None:
    """FakeClock.set() must reject naive datetimes."""
    clock = FakeClock(datetime(2026, 1, 1, tzinfo=UTC))
    naive = datetime(2026, 6, 1)
    with pytest.raises(ValueError, match="timezone-aware"):
        clock.set(naive)
