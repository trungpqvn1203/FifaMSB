"""Database repository for User, UserSession, and UserTeamHistory entities."""

import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.engine.cursor import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.auth.domain import User, UserSession, UserTeamHistory


async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    """Find a user by their unique username."""
    stmt = select(User).where(User.username == username)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Find a user by their primary key."""
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_users(session: AsyncSession) -> list[User]:
    """List all users ordered by username."""
    stmt = select(User).order_by(User.username.asc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_user(
    session: AsyncSession,
    username: str,
    password_hash: str,
    role: str,
    team_id: uuid.UUID | None = None,
) -> User:
    """Create and persist a new user."""
    user = User(
        username=username,
        password_hash=password_hash,
        role=role,
        team_id=team_id,
    )
    session.add(user)
    await session.flush()
    return user


async def create_session(
    session: AsyncSession,
    session_id: str,
    user_id: uuid.UUID,
    expires_at: datetime,
    created_at: datetime,
) -> UserSession:
    """Create and persist a new login session."""
    user_session = UserSession(
        id=session_id,
        user_id=user_id,
        expires_at=expires_at,
        created_at=created_at,
    )
    session.add(user_session)
    await session.flush()
    return user_session


async def get_session_by_token(session: AsyncSession, session_id: str) -> UserSession | None:
    """Find a session by token string, eagerly loading the associated user."""
    stmt = (
        select(UserSession)
        .options(joinedload(UserSession.user))
        .where(UserSession.id == session_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def delete_session(session: AsyncSession, session_id: str) -> None:
    """Delete a session by its token string."""
    stmt = delete(UserSession).where(UserSession.id == session_id)
    await session.execute(stmt)


async def delete_expired_sessions(session: AsyncSession, now: datetime) -> int:
    """Delete all sessions expired before the given timestamp."""
    stmt = delete(UserSession).where(UserSession.expires_at <= now)
    result = await session.execute(stmt)
    if isinstance(result, CursorResult):
        return int(result.rowcount)
    return 0


async def create_user_team_history(
    session: AsyncSession,
    user_id: uuid.UUID,
    team_id: uuid.UUID,
    tournament_id: uuid.UUID,
    joined_at: datetime,
) -> UserTeamHistory:
    """Append one history row recording that user was assigned to a team."""
    record = UserTeamHistory(
        user_id=user_id,
        team_id=team_id,
        tournament_id=tournament_id,
        joined_at=joined_at,
    )
    session.add(record)
    await session.flush()
    return record


async def get_user_team_history(session: AsyncSession, user_id: uuid.UUID) -> list[UserTeamHistory]:
    """Return all team assignment records for a user, newest first."""
    stmt = (
        select(UserTeamHistory)
        .where(UserTeamHistory.user_id == user_id)
        .order_by(UserTeamHistory.joined_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
