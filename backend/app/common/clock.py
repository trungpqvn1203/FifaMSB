"""Clock protocol and implementations.

WHY: We inject Clock everywhere instead of calling datetime.now() directly
so that tests can use FakeClock to control time without real sleeps.
All production code must use an injected Clock instance.
"""

from datetime import UTC, datetime
from typing import Protocol


class Clock(Protocol):
    """Protocol for time source injection."""

    def now(self) -> datetime:
        """Return current time as timezone-aware UTC datetime."""
        ...


class SystemClock:
    """Production clock — reads actual wall-clock UTC time."""

    def now(self) -> datetime:
        """Return current UTC datetime with tzinfo=UTC."""
        return datetime.now(tz=UTC)


default_clock: Clock = SystemClock()


def get_clock() -> Clock:
    """FastAPI dependency for Clock injection."""
    return default_clock


class FakeClock:
    """Test clock — time is fully controlled by the test.

    Usage:
        clock = FakeClock(datetime(2024, 1, 1, tzinfo=timezone.utc))
        clock.advance(seconds=30)
    """

    def __init__(self, initial: datetime) -> None:
        # Store as UTC-aware datetime
        if initial.tzinfo is None:
            raise ValueError("FakeClock requires a timezone-aware datetime")
        self._current = initial

    def now(self) -> datetime:
        """Return the faked current time."""
        return self._current

    def advance(self, *, seconds: float = 0.0, minutes: float = 0.0) -> None:
        """Advance the clock by the given offset. No real sleep occurs."""
        from datetime import timedelta

        delta = timedelta(seconds=seconds, minutes=minutes)
        self._current += delta

    def set(self, dt: datetime) -> None:
        """Set the clock to an arbitrary datetime."""
        if dt.tzinfo is None:
            raise ValueError("FakeClock.set requires a timezone-aware datetime")
        self._current = dt
