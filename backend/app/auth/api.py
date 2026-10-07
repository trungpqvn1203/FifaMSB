"""Authentication and admin user management API endpoints and Pydantic schemas."""

import uuid

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field

from app.auth.dependencies import (
    get_auth_service,
    get_current_user,
    require_admin,
)
from app.auth.domain import User
from app.auth.service import AuthService
from app.config import settings

auth_router = APIRouter()
admin_users_router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    username: str
    role: str
    team_id: uuid.UUID | None = Field(default=None, serialization_alias="teamId")


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    username: str
    password: str
    team_id: uuid.UUID | None = Field(default=None, alias="teamId")
    # tournament_id is used to write the initial UserTeamHistory row on creation
    tournament_id: uuid.UUID | None = Field(default=None, alias="tournamentId")
    role: str = "TEAM_USER"


class AssignTeamRequest(BaseModel):
    """Body for PATCH /admin/users/{user_id}/team."""

    model_config = ConfigDict(populate_by_name=True)

    team_id: uuid.UUID = Field(alias="teamId")
    tournament_id: uuid.UUID = Field(alias="tournamentId")


class UserTeamHistoryItem(BaseModel):
    """One row from user_team_history — shown in the history endpoint."""

    model_config = ConfigDict(populate_by_name=True)

    id: uuid.UUID
    team_id: uuid.UUID | None = Field(default=None, serialization_alias="teamId")
    tournament_id: uuid.UUID | None = Field(default=None, serialization_alias="tournamentId")
    joined_at: str = Field(serialization_alias="joinedAt")


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@auth_router.post("/login", response_model=UserResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """Authenticate user with username and password, setting HttpOnly session cookie."""
    user, token = await auth_service.login(payload.username, payload.password)

    # Set HttpOnly, SameSite=Lax session cookie
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        max_age=settings.session_expire_hours * 3600,
        path="/",
    )

    return UserResponse.model_validate(user)


@auth_router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    """Invalidate current session and remove the session cookie."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if token:
        await auth_service.logout(token)

    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
    )
    return {"status": "ok"}


@auth_router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)


# ---------------------------------------------------------------------------
# Admin user management endpoints
# ---------------------------------------------------------------------------


@admin_users_router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_user(
    payload: CreateUserRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """Create a new user account (Admin only)."""
    user = await auth_service.create_user(
        username=payload.username,
        password=payload.password,
        role=payload.role,
        team_id=payload.team_id,
        tournament_id=payload.tournament_id,
    )
    return UserResponse.model_validate(user)


@admin_users_router.get(
    "/users",
    response_model=list[UserResponse],
    dependencies=[Depends(require_admin)],
)
async def list_users(
    auth_service: AuthService = Depends(get_auth_service),
) -> list[UserResponse]:
    """List all user accounts (Admin only)."""
    users = await auth_service.list_users()
    return [UserResponse.model_validate(u) for u in users]


@admin_users_router.patch(
    "/users/{user_id}/team",
    response_model=UserResponse,
    dependencies=[Depends(require_admin)],
)
async def reassign_user_team(
    user_id: uuid.UUID,
    payload: AssignTeamRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """Reassign an existing user to a new team in a new tournament (Admin only).

    Use this when a coordinator from a previous tournament is participating again:
    instead of creating a new account, update their team_id and keep the same
    username / password. History of past assignments is preserved in user_team_history.
    """
    user = await auth_service.reassign_user_to_team(
        user_id=user_id,
        team_id=payload.team_id,
        tournament_id=payload.tournament_id,
    )
    return UserResponse.model_validate(user)


@admin_users_router.get(
    "/users/{user_id}/history",
    response_model=list[UserTeamHistoryItem],
    dependencies=[Depends(require_admin)],
)
async def get_user_history(
    user_id: uuid.UUID,
    auth_service: AuthService = Depends(get_auth_service),
) -> list[UserTeamHistoryItem]:
    """Return the full team-assignment history for a user (Admin only).

    Useful to see which tournaments a coordinator has participated in before
    reassigning them to a new tournament.
    """
    history = await auth_service.get_user_history(user_id)
    return [
        UserTeamHistoryItem(
            id=h.id,
            team_id=h.team_id,
            tournament_id=h.tournament_id,
            joined_at=h.joined_at.isoformat(),
        )
        for h in history
    ]
