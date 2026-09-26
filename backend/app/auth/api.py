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
    role: str = "TEAM_USER"


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
