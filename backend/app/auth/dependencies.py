"""FastAPI dependencies for authentication and role-based access control."""

import uuid

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.domain import User
from app.auth.service import AuthService
from app.common.clock import Clock, get_clock
from app.common.errors import Forbidden, NoTeamAssigned, Unauthorized
from app.config import settings
from app.db import get_session


def get_auth_service(
    session: AsyncSession = Depends(get_session),
    clock: Clock = Depends(get_clock),
) -> AuthService:
    """Dependency providing an AuthService instance with request-scoped session and clock."""
    return AuthService(session=session, clock=clock)


async def get_current_user(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Extract session token from cookie (or Authorization header) and resolve User.

    Raises:
        Unauthorized: If no session token is present or the session is invalid/expired.
    """
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        # Fallback: check Authorization: Bearer <token> for testing convenience
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise Unauthorized("Authentication required.")

    return await auth_service.authenticate_session(token)


async def get_optional_current_user(
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> User | None:
    """Extract session token from cookie/header, returning None if unauthenticated."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        return None

    try:
        return await auth_service.authenticate_session(token)
    except Exception:
        return None


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Ensure the authenticated user has the ADMIN role.

    Raises:
        Forbidden: If the user is not an ADMIN.
    """
    if user.role != "ADMIN":
        raise Forbidden("Admin privileges required.")
    return user


def get_current_team(user: User = Depends(get_current_user)) -> uuid.UUID:
    """Extract and validate the team_id assigned to the current user.

    Raises:
        NoTeamAssigned: If the user does not have an assigned team.
    """
    if user.team_id is None:
        raise NoTeamAssigned()
    return user.team_id
