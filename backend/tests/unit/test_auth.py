"""Unit tests for Auth service, password hashing, and dependencies."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.dependencies import get_current_team, require_admin
from app.auth.domain import User, UserSession
from app.auth.service import (
    AuthService,
    generate_session_token,
    hash_password,
    verify_password,
)
from app.common.clock import FakeClock
from app.common.errors import (
    Forbidden,
    InvalidCredentials,
    NoTeamAssigned,
    Unauthorized,
)


@pytest.mark.unit
def test_password_hashing_and_verification() -> None:
    """bcrypt hashing and verification works as expected."""
    pw = "supersecret123"
    hashed = hash_password(pw)

    assert hashed.startswith("$2b$")
    assert verify_password(pw, hashed) is True
    assert verify_password("wrongpassword", hashed) is False
    assert verify_password(pw, "invalid_hash_format") is False


@pytest.mark.unit
def test_generate_session_token() -> None:
    """generate_session_token produces a 64-char hex string."""
    token = generate_session_token()
    assert isinstance(token, str)
    assert len(token) == 64
    # Tokens must be unique
    token2 = generate_session_token()
    assert token != token2


@pytest.mark.unit
def test_require_admin_allows_admin() -> None:
    """require_admin returns the user when role is ADMIN."""
    admin_user = User(
        id=uuid.uuid4(),
        username="admin",
        password_hash="hash",
        role="ADMIN",
        team_id=None,
    )
    result = require_admin(admin_user)
    assert result is admin_user


@pytest.mark.unit
def test_require_admin_rejects_non_admin() -> None:
    """require_admin raises Forbidden when role is not ADMIN."""
    team_user = User(
        id=uuid.uuid4(),
        username="team1",
        password_hash="hash",
        role="TEAM_USER",
        team_id=uuid.uuid4(),
    )
    with pytest.raises(Forbidden) as exc_info:
        require_admin(team_user)
    assert exc_info.value.code == "FORBIDDEN"
    assert exc_info.value.http_status == 403


@pytest.mark.unit
def test_get_current_team_returns_team_id() -> None:
    """get_current_team returns team_id when assigned."""
    team_id = uuid.uuid4()
    user = User(
        id=uuid.uuid4(),
        username="team1",
        password_hash="hash",
        role="TEAM_USER",
        team_id=team_id,
    )
    assert get_current_team(user) == team_id


@pytest.mark.unit
def test_get_current_team_raises_when_no_team() -> None:
    """get_current_team raises NoTeamAssigned when team_id is None."""
    user = User(
        id=uuid.uuid4(),
        username="admin",
        password_hash="hash",
        role="ADMIN",
        team_id=None,
    )
    with pytest.raises(NoTeamAssigned) as exc_info:
        get_current_team(user)
    assert exc_info.value.code == "NO_TEAM_ASSIGNED"
    assert exc_info.value.http_status == 403


@pytest.mark.unit
async def test_auth_service_login_invalid_username() -> None:
    """AuthService.login raises InvalidCredentials if user not found."""
    mock_session = AsyncMock()
    clock = FakeClock(datetime(2026, 1, 1, tzinfo=UTC))
    service = AuthService(mock_session, clock)

    with pytest.raises(InvalidCredentials):
        # mock repository returns None
        mock_session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )
        await service.login("nonexistent", "password")


@pytest.mark.unit
async def test_auth_service_login_wrong_password() -> None:
    """AuthService.login raises InvalidCredentials if password does not match."""
    mock_session = AsyncMock()
    clock = FakeClock(datetime(2026, 1, 1, tzinfo=UTC))
    service = AuthService(mock_session, clock)

    user = User(
        id=uuid.uuid4(),
        username="user1",
        password_hash=hash_password("correct_pass"),
        role="TEAM_USER",
    )
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=user))
    )

    with pytest.raises(InvalidCredentials):
        await service.login("user1", "wrong_pass")


@pytest.mark.unit
async def test_auth_service_authenticate_session_expired() -> None:
    """Expired session raises Unauthorized and is deleted."""
    mock_session = AsyncMock()
    initial_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    clock = FakeClock(initial_time)
    service = AuthService(mock_session, clock)

    user = User(
        id=uuid.uuid4(),
        username="user1",
        password_hash="hash",
        role="TEAM_USER",
    )
    session_record = UserSession(
        id="test_token",
        user_id=user.id,
        expires_at=datetime(2026, 1, 1, 11, 0, 0, tzinfo=UTC),  # expired 1 hour ago
        created_at=datetime(2026, 1, 1, 8, 0, 0, tzinfo=UTC),
    )
    session_record.user = user

    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=session_record))
    )

    with pytest.raises(Unauthorized) as exc_info:
        await service.authenticate_session("test_token")
    assert "expired" in str(exc_info.value).lower()
