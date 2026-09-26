"""Domain error hierarchy and all application error codes.

All business rule violations should raise a subclass of DomainError.
FastAPI exception handlers convert these to RFC 9457 ProblemDetail JSON.
Stack traces are NEVER returned to clients.
"""

from dataclasses import dataclass


@dataclass
class DomainError(Exception):
    """Base class for all domain / business rule errors.

    Attributes:
        code: Machine-readable error identifier (e.g. "NOT_YOUR_TURN").
        http_status: HTTP status code (e.g. 403, 404, 409, 422).
        message: Human-readable description of the error.
    """

    code: str
    http_status: int
    message: str

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


# ---------------------------------------------------------------------------
# Draft errors
# ---------------------------------------------------------------------------


class DraftNotFound(DomainError):
    def __init__(self, draft_id: str) -> None:
        super().__init__(
            code="DRAFT_NOT_FOUND",
            http_status=404,
            message=f"Draft session '{draft_id}' does not exist.",
        )


class DraftNotActive(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="DRAFT_NOT_ACTIVE",
            http_status=422,
            message="The draft session is not currently in PICKING state.",
        )


class DraftCompleted(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="DRAFT_COMPLETED",
            http_status=422,
            message="The draft session is already completed.",
        )


class DraftVersionMismatch(DomainError):
    def __init__(self, expected: int, current: int) -> None:
        super().__init__(
            code="DRAFT_VERSION_MISMATCH",
            http_status=409,
            message=f"Draft version mismatch: expected {expected}, current version is {current}.",
        )


class NotYourTurn(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="NOT_YOUR_TURN",
            http_status=403,
            message="It is not your team's turn to pick.",
        )


class TurnExpired(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="TURN_EXPIRED",
            http_status=422,
            message="The turn timer expired before the pick was processed.",
        )


class DraftPoolTooSmall(DomainError):
    def __init__(self, available: int, required: int) -> None:
        super().__init__(
            code="DRAFT_POOL_TOO_SMALL",
            http_status=422,
            message=(
                f"Player pool has only {available} ACTIVE cards; "
                f"need at least {required} (teams × rosterSize)."
            ),
        )


# ---------------------------------------------------------------------------
# Player / pick errors
# ---------------------------------------------------------------------------


class PlayerNotFound(DomainError):
    def __init__(self, player_season_id: str) -> None:
        super().__init__(
            code="PLAYER_NOT_FOUND",
            http_status=404,
            message=f"PlayerSeason '{player_season_id}' does not exist.",
        )


class PlayerNotAvailable(DomainError):
    """Raised when a PlayerSeason has status INACTIVE."""

    def __init__(self) -> None:
        super().__init__(
            code="PLAYER_NOT_AVAILABLE",
            http_status=422,
            message="This player card has status INACTIVE and cannot be drafted.",
        )


class SeasonNotAllowed(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="SEASON_NOT_ALLOWED",
            http_status=422,
            message="This player card belongs to a season not allowed in this tournament.",
        )


class PlayerAlreadyPicked(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="PLAYER_ALREADY_PICKED",
            http_status=409,
            message="This player card (or player identity) has already been picked in this draft.",
        )


class BudgetExceeded(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="BUDGET_EXCEEDED",
            http_status=422,
            message="This pick would exceed your team's budget cap.",
        )


class BudgetInsufficientForRoster(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="BUDGET_INSUFFICIENT_FOR_ROSTER",
            http_status=422,
            message=(
                "Remaining budget is insufficient to fill the remaining roster slots "
                "at minimum salary."
            ),
        )


class TeamRosterFull(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="TEAM_ROSTER_FULL",
            http_status=422,
            message="Your team's roster is already full.",
        )


class PoolLocked(DomainError):
    """Raised when player pool modification is attempted while draft is active."""

    def __init__(self) -> None:
        super().__init__(
            code="POOL_LOCKED",
            http_status=422,
            message="The player pool cannot be modified while a draft is PICKING or PAUSED.",
        )


# ---------------------------------------------------------------------------
# Match / ban errors
# ---------------------------------------------------------------------------


class MatchNotFound(DomainError):
    def __init__(self, match_id: str) -> None:
        super().__init__(
            code="MATCH_NOT_FOUND",
            http_status=404,
            message=f"Match '{match_id}' does not exist.",
        )


class MatchNotActive(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="MATCH_NOT_ACTIVE",
            http_status=422,
            message="The match is not currently in BAN_PHASE.",
        )


class SameTeamMatch(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="SAME_TEAM_MATCH",
            http_status=422,
            message="Home team and away team must be different.",
        )


class PlayerNotInRoster(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="PLAYER_NOT_IN_ROSTER",
            http_status=422,
            message="The target player is not in the target team's drafted roster.",
        )


class BanLimitReached(DomainError):
    def __init__(self, limit: int) -> None:
        super().__init__(
            code="BAN_LIMIT_REACHED",
            http_status=422,
            message=f"Your team has already reached the maximum of {limit} bans.",
        )


class BansAlreadyConfirmed(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="BANS_ALREADY_CONFIRMED",
            http_status=422,
            message="Your team has already confirmed its bans and cannot modify them.",
        )


class BansLocked(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="BANS_LOCKED",
            http_status=422,
            message="Match bans are locked and cannot be modified.",
        )


class TeamNotInMatch(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="TEAM_NOT_IN_MATCH",
            http_status=403,
            message="Your team is not a participant in this match.",
        )


class BanNotFound(DomainError):
    def __init__(self, ban_id: str) -> None:
        super().__init__(
            code="BAN_NOT_FOUND",
            http_status=404,
            message=f"Match ban '{ban_id}' does not exist.",
        )


class PlayerAlreadyBanned(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="PLAYER_ALREADY_BANNED",
            http_status=409,
            message="This player card has already been banned by your team.",
        )


class MatchNotReady(DomainError):
    def __init__(self, message: str = "Match is not ready to start ban phase.") -> None:
        super().__init__(
            code="MATCH_NOT_READY",
            http_status=422,
            message=message,
        )


# ---------------------------------------------------------------------------
# Tournament & Team errors
# ---------------------------------------------------------------------------


class TournamentNotFound(DomainError):
    def __init__(self, tournament_id: str) -> None:
        super().__init__(
            code="TOURNAMENT_NOT_FOUND",
            http_status=404,
            message=f"Tournament '{tournament_id}' does not exist.",
        )


class TournamentNotReady(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="TOURNAMENT_NOT_READY",
            http_status=422,
            message=(
                "Tournament must have status READY (at least 2 teams registered) "
                "before a draft can start."
            ),
        )


class TournamentNotModifiable(DomainError):
    def __init__(self, status: str) -> None:
        super().__init__(
            code="TOURNAMENT_NOT_MODIFIABLE",
            http_status=409,
            message=(
                f"Cannot update tournament in status '{status}'. "
                "Only DRAFT and READY tournaments can be modified."
            ),
        )


class DraftOrderConflict(DomainError):
    def __init__(self, draft_order: int) -> None:
        super().__init__(
            code="DRAFT_ORDER_CONFLICT",
            http_status=409,
            message=(
                f"Draft order {draft_order} is already taken by another team in this tournament."
            ),
        )


class TeamNotFound(DomainError):
    def __init__(self, team_id: str) -> None:
        super().__init__(
            code="TEAM_NOT_FOUND",
            http_status=404,
            message=f"Team '{team_id}' does not exist.",
        )


# ---------------------------------------------------------------------------
# Auth & User errors
# ---------------------------------------------------------------------------


class InvalidCredentials(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="INVALID_CREDENTIALS",
            http_status=401,
            message="Invalid username or password.",
        )


class Unauthorized(DomainError):
    def __init__(self, message: str = "Authentication required.") -> None:
        super().__init__(
            code="UNAUTHORIZED",
            http_status=401,
            message=message,
        )


class Forbidden(DomainError):
    def __init__(self, message: str = "You do not have permission to perform this action.") -> None:
        super().__init__(
            code="FORBIDDEN",
            http_status=403,
            message=message,
        )


class UserNotFound(DomainError):
    def __init__(self, identifier: str) -> None:
        super().__init__(
            code="USER_NOT_FOUND",
            http_status=404,
            message=f"User '{identifier}' not found.",
        )


class UsernameAlreadyExists(DomainError):
    def __init__(self, username: str) -> None:
        super().__init__(
            code="USERNAME_ALREADY_EXISTS",
            http_status=409,
            message=f"Username '{username}' is already taken.",
        )


class NoTeamAssigned(DomainError):
    def __init__(self) -> None:
        super().__init__(
            code="NO_TEAM_ASSIGNED",
            http_status=403,
            message="The authenticated user is not assigned to any team.",
        )
