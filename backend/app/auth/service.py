"""Authentication service: password hashing, session tokens, and business logic."""

import secrets
import uuid
from datetime import timedelta

import bcrypt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import repository
from app.auth.domain import User, UserTeamHistory
from app.common.clock import Clock
from app.common.errors import (
    InvalidCredentials,
    Unauthorized,
    UserAlreadyAssignedToTeam,
    UsernameAlreadyExists,
    UserNotFound,
)
from app.config import settings


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt directly."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def generate_session_token() -> str:
    """Generate a cryptographically secure random session token."""
    return secrets.token_hex(32)


class AuthService:
    """Handles authentication, session lifecycle, and user management."""

    def __init__(
        self,
        session: AsyncSession,
        clock: Clock,
        expire_hours: int = settings.session_expire_hours,
    ) -> None:
        self.session = session
        self.clock = clock
        self.expire_hours = expire_hours

    async def login(self, username: str, password: str) -> tuple[User, str]:
        """Authenticate user by username and password.

        Returns:
            Tuple of (User, session_token).

        Raises:
            InvalidCredentials: If username is not found or password does not match.
        """
        user = await repository.get_user_by_username(self.session, username)
        if user is None:
            raise InvalidCredentials()

        if not verify_password(password, user.password_hash):
            raise InvalidCredentials()

        token = generate_session_token()
        now = self.clock.now()
        expires_at = now + timedelta(hours=self.expire_hours)

        await repository.create_session(
            session=self.session,
            session_id=token,
            user_id=user.id,
            expires_at=expires_at,
            created_at=now,
        )
        await self.session.commit()
        return user, token

    async def logout(self, token: str) -> None:
        """Invalidate the session by token."""
        await repository.delete_session(self.session, token)
        await self.session.commit()

    async def authenticate_session(self, token: str) -> User:
        """Validate a session token and return the associated User.

        Raises:
            Unauthorized: If the token is unknown or expired.
        """
        user_session = await repository.get_session_by_token(self.session, token)
        if user_session is None:
            raise Unauthorized("Invalid or expired session.")

        now = self.clock.now()
        if user_session.expires_at <= now:
            await repository.delete_session(self.session, token)
            await self.session.commit()
            raise Unauthorized("Session has expired.")

        return user_session.user

    async def create_user(
        self,
        username: str,
        password: str,
        role: str = "TEAM_USER",
        team_id: uuid.UUID | None = None,
        # tournament_id is needed to write the history row; optional because ADMIN users have none
        tournament_id: uuid.UUID | None = None,
    ) -> User:
        """Create a new user with hashed password.

        If team_id is provided, also writes one UserTeamHistory row so we can
        track which tournaments this coordinator has participated in.

        Raises:
            UsernameAlreadyExists: If the username is already taken.
        """
        hashed = hash_password(password)
        try:
            user = await repository.create_user(
                session=self.session,
                username=username,
                password_hash=hashed,
                role=role,
                team_id=team_id,
            )
            # Write history row immediately if a team assignment exists
            if team_id is not None and tournament_id is not None:
                await repository.create_user_team_history(
                    session=self.session,
                    user_id=user.id,
                    team_id=team_id,
                    tournament_id=tournament_id,
                    joined_at=self.clock.now(),
                )
            await self.session.commit()
            return user
        except IntegrityError as exc:
            await self.session.rollback()
            # Map username uniqueness constraint violation
            if "uq_users_username" in str(exc).lower() or "username" in str(exc).lower():
                raise UsernameAlreadyExists(username) from exc
            raise

    async def list_users(self) -> list[User]:
        """List all users."""
        return await repository.list_users(self.session)

    async def get_user_by_id(self, user_id: uuid.UUID) -> User:
        """Return a user by ID or raise UserNotFound."""
        user = await repository.get_user_by_id(self.session, user_id)
        if user is None:
            raise UserNotFound(str(user_id))
        return user

    async def reassign_user_to_team(
        self,
        user_id: uuid.UUID,
        team_id: uuid.UUID,
        tournament_id: uuid.UUID,
    ) -> User:
        """Move an existing TEAM_USER to a different team in a new tournament.

        Updates user.team_id and appends one UserTeamHistory row.
        This is the main "reuse account across tournaments" operation.

        Raises:
            UserNotFound: If user_id does not exist.
            UserAlreadyAssignedToTeam: If user is already on that exact team.
        """
        user = await repository.get_user_by_id(self.session, user_id)
        if user is None:
            raise UserNotFound(str(user_id))

        # Guard: already on the same team — nothing to do, likely a client mistake
        if user.team_id == team_id:
            raise UserAlreadyAssignedToTeam(str(team_id))

        user.team_id = team_id
        # Write history before commit so both changes land in the same transaction
        await repository.create_user_team_history(
            session=self.session,
            user_id=user.id,
            team_id=team_id,
            tournament_id=tournament_id,
            joined_at=self.clock.now(),
        )
        await self.session.commit()
        # Re-fetch to return a clean, fully-loaded object
        refreshed = await repository.get_user_by_id(self.session, user.id)
        assert refreshed is not None
        return refreshed

    async def get_user_history(self, user_id: uuid.UUID) -> list[UserTeamHistory]:
        """Return the full team assignment history for a user, newest first."""
        # Ensure user exists before returning history
        user = await repository.get_user_by_id(self.session, user_id)
        if user is None:
            raise UserNotFound(str(user_id))
        return await repository.get_user_team_history(self.session, user_id)
