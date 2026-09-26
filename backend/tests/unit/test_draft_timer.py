"""Unit tests for DraftTimer background loop logic with FakeClock.

No real database or sleep required.
"""

import asyncio
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.common.clock import FakeClock
from app.draft.broadcaster import NoOpDraftBroadcaster
from app.draft.timer import DraftTimer


class DummySessionContext:
    """Mock session context manager for testing DraftTimer."""

    def __init__(self, session: AsyncMock) -> None:
        self.session = session

    async def __aenter__(self) -> AsyncMock:
        return self.session

    async def __aexit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        pass


@pytest.mark.unit
async def test_draft_timer_no_expired_drafts() -> None:
    now = datetime(2026, 9, 21, 10, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)
    broadcaster = NoOpDraftBroadcaster()

    mock_session = AsyncMock()
    session_factory = lambda: DummySessionContext(mock_session)  # noqa: E731

    timer = DraftTimer(
        session_factory=session_factory,  # type: ignore[arg-type]
        clock=clock,
        broadcaster=broadcaster,
        poll_interval_seconds=0.1,
    )

    with patch("app.draft.repository.find_expired_draft_ids", return_value=[]):
        processed = await timer.check_and_apply_timeouts()
        assert processed == []


@pytest.mark.unit
async def test_draft_timer_processes_expired_drafts() -> None:
    now = datetime(2026, 9, 21, 10, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)
    broadcaster = NoOpDraftBroadcaster()

    mock_session = AsyncMock()
    session_factory = lambda: DummySessionContext(mock_session)  # noqa: E731

    timer = DraftTimer(
        session_factory=session_factory,  # type: ignore[arg-type]
        clock=clock,
        broadcaster=broadcaster,
        poll_interval_seconds=0.1,
    )

    expired_draft_id = uuid.uuid4()
    with (
        patch("app.draft.repository.find_expired_draft_ids", return_value=[expired_draft_id]),
        patch("app.draft.service.DraftService.apply_timeout", new_callable=AsyncMock) as mock_apply,
    ):
        processed = await timer.check_and_apply_timeouts()
        assert processed == [expired_draft_id]
        mock_apply.assert_awaited_once_with(expired_draft_id)


@pytest.mark.unit
async def test_draft_timer_loop_stops_on_event() -> None:
    now = datetime(2026, 9, 21, 10, 0, 0, tzinfo=UTC)
    clock = FakeClock(now)
    broadcaster = NoOpDraftBroadcaster()

    mock_session = AsyncMock()
    session_factory = lambda: DummySessionContext(mock_session)  # noqa: E731

    timer = DraftTimer(
        session_factory=session_factory,  # type: ignore[arg-type]
        clock=clock,
        broadcaster=broadcaster,
        poll_interval_seconds=0.01,
    )

    stop_event = asyncio.Event()
    stop_event.set()  # Stop immediately

    with patch.object(timer, "check_and_apply_timeouts", new_callable=AsyncMock) as mock_check:
        await timer.run_loop(stop_event)
        # Should not hang; loop stopped immediately
        assert not stop_event.is_set() or mock_check.call_count <= 1
