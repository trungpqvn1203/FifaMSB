"""FastAPI application entry point.

Registers routers, lifespan, exception handlers (RFC 9457),
and request-id logging middleware.
"""

import asyncio
import contextlib
import logging
import traceback
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.auth.api import admin_users_router, auth_router
from app.common.clock import SystemClock
from app.common.errors import DomainError
from app.config import settings
from app.db import AsyncSessionFactory
from app.draft.api import drafts_router, tournaments_draft_router
from app.draft.broadcaster import get_draft_broadcaster
from app.draft.timer import DraftTimer
from app.draft.ws import ws_router
from app.match.api import matches_router, tournaments_match_router
from app.match.ws import match_ws_router
from app.player.api import (
    admin_player_router,
    player_seasons_router,
    seasons_router,
)
from app.tournament.api import teams_router, tournaments_router

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown hook.

    Starts the background DraftTimer loop on startup and stops it on shutdown.
    """
    logger.info("Starting up FC Online Draft System (env=%s)", settings.environment)
    stop_event = asyncio.Event()
    timer = DraftTimer(
        session_factory=AsyncSessionFactory,
        clock=SystemClock(),
        broadcaster=get_draft_broadcaster(),
        poll_interval_seconds=1.0,
    )
    timer_task = asyncio.create_task(timer.run_loop(stop_event))

    try:
        yield
    finally:
        logger.info("Shutting down FC Online Draft System")
        stop_event.set()
        timer_task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await timer_task


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="FC Online Draft System",
    version="0.1.0",
    description="Realtime multi-team player draft system for Vietnamese FC Online pro tournament.",
    lifespan=lifespan,
    # Disable automatic validation error detail leakage to clients
    # (we override below with RFC 9457 shape)
)


# ---------------------------------------------------------------------------
# Request-ID middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def request_id_middleware(request: Request, call_next: Any) -> Any:
    """Attach a unique request ID to every request for log correlation."""
    request_id = str(uuid.uuid4())
    # Store on request state so handlers can access it
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ---------------------------------------------------------------------------
# RFC 9457 ProblemDetail exception handlers
# ---------------------------------------------------------------------------
ERROR_TYPE_BASE = "https://fifadraft.example.com/errors"


def _problem_detail(
    status: int,
    code: str,
    title: str,
    message: str,
) -> dict[str, object]:
    slug = code.lower().replace("_", "-")
    return {
        "type": f"{ERROR_TYPE_BASE}/{slug}",
        "title": title,
        "status": status,
        "code": code,
        "message": message,
    }


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    """Convert DomainError into RFC 9457 JSON response. No stack trace."""
    title = exc.code.replace("_", " ").title()
    body = _problem_detail(exc.http_status, exc.code, title, exc.message)
    return JSONResponse(status_code=exc.http_status, content=body)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Convert Pydantic validation errors to RFC 9457 shape (400)."""
    # Flatten all errors into a single message string
    messages = "; ".join(
        f"{'.'.join(str(loc) for loc in e['loc'])}: {e['msg']}" for e in exc.errors()
    )
    body = _problem_detail(400, "VALIDATION_ERROR", "Validation Error", messages)
    return JSONResponse(status_code=400, content=body)


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler — logs full traceback but returns only INTERNAL_ERROR to client."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "Unhandled exception (request_id=%s): %s\n%s",
        request_id,
        exc,
        traceback.format_exc(),
    )
    body = _problem_detail(
        500, "INTERNAL_ERROR", "Internal Server Error", "An unexpected error occurred."
    )
    return JSONResponse(status_code=500, content=body)


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Infrastructure"])
async def health() -> dict[str, str]:
    """Liveness probe — returns 200 when the process is running."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Feature Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(admin_users_router, prefix="/api/admin", tags=["Admin Users"])
app.include_router(seasons_router, prefix="/api/seasons", tags=["Seasons"])
app.include_router(player_seasons_router, prefix="/api/player-seasons", tags=["Player Seasons"])
app.include_router(admin_player_router, prefix="/api/admin", tags=["Admin Players"])
app.include_router(tournaments_router, prefix="/api/tournaments", tags=["Tournaments"])
app.include_router(teams_router, prefix="/api/teams", tags=["Teams"])
app.include_router(tournaments_draft_router)
app.include_router(drafts_router)
app.include_router(ws_router)
app.include_router(tournaments_match_router)
app.include_router(matches_router)
app.include_router(match_ws_router)
