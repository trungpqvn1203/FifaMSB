"""Application service orchestrating Match and Tactical Ban business logic."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.clock import Clock
from app.common.errors import (
    BanLimitReached,
    BanNotFound,
    BansAlreadyConfirmed,
    BansLocked,
    MatchNotActive,
    MatchNotFound,
    PlayerAlreadyBanned,
    PlayerNotInRoster,
    SameTeamMatch,
    TeamNotFound,
    TeamNotInMatch,
    TournamentNotFound,
)
from app.match import repository
from app.match.broadcaster import MatchBroadcaster
from app.match.domain import Match, MatchBan
from app.tournament import repository as tournament_repo


class MatchService:
    """Coordinates match lifecycle, tactical ban validations, auto-locking, and broadcasts."""

    def __init__(
        self,
        session: AsyncSession,
        clock: Clock,
        broadcaster: MatchBroadcaster,
    ) -> None:
        self._session = session
        self._clock = clock
        self._broadcaster = broadcaster

    # ------------------------------------------------------------------
    # Match Lifecycle & Scheduling
    # ------------------------------------------------------------------

    async def create_match(
        self,
        tournament_id: uuid.UUID,
        home_team_id: uuid.UUID,
        away_team_id: uuid.UUID,
        scheduled_at: str | None = None,
    ) -> Match:
        """Schedule a new match between two tournament teams (ADMIN only)."""
        tournament = await tournament_repo.get_tournament_by_id(self._session, tournament_id)
        if tournament is None:
            raise TournamentNotFound(str(tournament_id))

        if home_team_id == away_team_id:
            raise SameTeamMatch()

        home_team = await tournament_repo.get_team_by_id(self._session, home_team_id)
        if home_team is None or home_team.tournament_id != tournament_id:
            raise TeamNotFound(str(home_team_id))

        away_team = await tournament_repo.get_team_by_id(self._session, away_team_id)
        if away_team is None or away_team.tournament_id != tournament_id:
            raise TeamNotFound(str(away_team_id))

        now = self._clock.now()
        sched_dt = None
        if scheduled_at:
            from datetime import datetime

            sched_dt = datetime.fromisoformat(scheduled_at)

        rules_snapshot = dict(tournament.rules)
        match = Match(
            id=uuid.uuid4(),
            tournament_id=tournament_id,
            home_team_id=home_team_id,
            away_team_id=away_team_id,
            status="SCHEDULED",
            scheduled_at=sched_dt,
            rules_snapshot=rules_snapshot,
            home_confirmed=False,
            away_confirmed=False,
            version=0,
            created_at=now,
            updated_at=now,
        )

        await repository.create_match(self._session, match)
        await self._session.commit()

        # Re-fetch with joined relations
        full_match = await repository.get_match_by_id(self._session, match.id)
        assert full_match is not None
        return full_match

    async def list_matches(self, tournament_id: uuid.UUID) -> list[Match]:
        """List all matches in a tournament."""
        return await repository.list_matches_for_tournament(self._session, tournament_id)

    async def get_match(self, match_id: uuid.UUID) -> Match:
        """Fetch match by ID or raise MatchNotFound."""
        match = await repository.get_match_by_id(self._session, match_id)
        if match is None:
            raise MatchNotFound(str(match_id))
        return match

    # ------------------------------------------------------------------
    # Ban Phase Orchestration
    # ------------------------------------------------------------------

    async def start_ban_phase(self, match_id: uuid.UUID) -> Match:
        """Start tactical ban phase for a match (ADMIN only)."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))

        if match.status != "SCHEDULED":
            raise MatchNotActive()

        ban_seconds = int(match.rules_snapshot.get("banTimeSeconds", 60))
        match.status = "BAN_PHASE"
        match.ban_started_at = now
        match.ban_expires_at = now + timedelta(seconds=ban_seconds)
        match.home_confirmed = False
        match.away_confirmed = False
        match.version += 1
        match.updated_at = now
        await self._session.commit()

        # Broadcast state
        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(full_match, "BAN_PHASE_STARTED")
        return full_match

    async def submit_ban(
        self,
        match_id: uuid.UUID,
        banning_team_id: uuid.UUID,
        player_season_id: uuid.UUID,
        target_team_id: uuid.UUID | None = None,
    ) -> MatchBan:
        """Submit a single player card ban under SELECT ... FOR UPDATE lock."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))

        if match.status != "BAN_PHASE":
            raise MatchNotActive()

        # Check expiry: auto-lock if time expired
        if match.is_ban_phase_expired(now):
            match.status = "BANS_LOCKED"
            match.version += 1
            match.updated_at = now
            await self._session.commit()
            raise BansLocked()

        if not match.is_participant(banning_team_id):
            raise TeamNotInMatch()

        if match.is_confirmed(banning_team_id):
            raise BansAlreadyConfirmed()

        # Resolve target team
        ban_target = match.rules_snapshot.get("banTarget", "OPPONENT_ROSTER")
        resolved_target = (
            match.get_opponent_team_id(banning_team_id)
            if ban_target == "OPPONENT_ROSTER"
            else banning_team_id
        )
        if target_team_id is not None and target_team_id != resolved_target:
            resolved_target = target_team_id

        # BR-M01: Target player must belong to the target team's drafted roster
        is_drafted = await repository.is_card_drafted_by_team(
            self._session, match.tournament_id, resolved_target, player_season_id
        )
        if not is_drafted:
            raise PlayerNotInRoster()

        # BR-M02: Check ban limit
        max_bans = int(match.rules_snapshot.get("banCount", 5))
        current_bans_count = await repository.get_team_bans_count(
            self._session, match_id, banning_team_id
        )
        if current_bans_count >= max_bans:
            raise BanLimitReached(max_bans)

        # Check if player card already banned by this team
        existing = [
            b
            for b in match.bans
            if b.banning_team_id == banning_team_id and b.player_season_id == player_season_id
        ]
        if existing:
            raise PlayerAlreadyBanned()

        ban = MatchBan(
            id=uuid.uuid4(),
            match_id=match_id,
            banning_team_id=banning_team_id,
            target_team_id=resolved_target,
            player_season_id=player_season_id,
            created_at=now,
        )
        await repository.create_match_ban(self._session, ban)
        match.version += 1
        match.updated_at = now
        await self._session.commit()

        # Broadcast state
        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(full_match, "BAN_SUBMITTED")

        created_ban = await repository.get_match_ban_by_id(self._session, ban.id)
        assert created_ban is not None
        return created_ban

    async def delete_ban(
        self,
        match_id: uuid.UUID,
        banning_team_id: uuid.UUID,
        ban_id: uuid.UUID,
    ) -> None:
        """Remove a pending ban before confirmation."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))

        if match.status != "BAN_PHASE":
            raise MatchNotActive()

        if match.is_ban_phase_expired(now):
            match.status = "BANS_LOCKED"
            match.version += 1
            match.updated_at = now
            await self._session.commit()
            raise BansLocked()

        if not match.is_participant(banning_team_id):
            raise TeamNotInMatch()

        if match.is_confirmed(banning_team_id):
            raise BansAlreadyConfirmed()

        ban = await repository.get_match_ban_by_id(self._session, ban_id)
        if ban is None or ban.match_id != match_id:
            raise BanNotFound(str(ban_id))

        if ban.banning_team_id != banning_team_id:
            raise TeamNotInMatch()

        await repository.delete_match_ban(self._session, ban)
        match.version += 1
        match.updated_at = now
        await self._session.commit()

        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(full_match, "BAN_DELETED")

    async def confirm_bans(self, match_id: uuid.UUID, team_id: uuid.UUID) -> Match:
        """Confirm a team's bans. When both confirm, status transitions to BANS_LOCKED."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))

        if match.status != "BAN_PHASE":
            raise MatchNotActive()

        if not match.is_participant(team_id):
            raise TeamNotInMatch()

        if team_id == match.home_team_id:
            match.home_confirmed = True
        elif team_id == match.away_team_id:
            match.away_confirmed = True

        if match.are_both_confirmed():
            match.status = "BANS_LOCKED"

        match.version += 1
        match.updated_at = now
        await self._session.commit()

        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(full_match, "BANS_CONFIRMED")
        return full_match

    async def lock_expired_bans(self, match_id: uuid.UUID) -> bool:
        """Lock match bans if ban_expires_at has passed (called by background timer loop)."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None or match.status != "BAN_PHASE":
            return False

        if match.is_ban_phase_expired(now):
            match.status = "BANS_LOCKED"
            match.version += 1
            match.updated_at = now
            await self._session.commit()
        else:
            return False

        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(full_match, "BANS_LOCKED")
        return True

    async def complete_match(self, match_id: uuid.UUID) -> Match:
        """Mark match as COMPLETED (ADMIN only)."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))

        match.status = "COMPLETED"
        match.version += 1
        match.updated_at = now
        await self._session.commit()

        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(full_match, "MATCH_COMPLETED")
        return full_match

    # ------------------------------------------------------------------
    # Secrecy Filtering & Snapshot Generation (BR-M04)
    # ------------------------------------------------------------------

    def build_match_view_dict(
        self,
        match: Match,
        viewer_team_id: uuid.UUID | None = None,
        is_admin: bool = False,
    ) -> dict[str, Any]:
        """Build dictionary representation respecting SIMULTANEOUS privacy rules (BR-M04).

        In SIMULTANEOUS ban phase:
        - Participating team sees full details of its own bans and only count of opponent bans.
        - Spectator / unauthenticated viewer sees only ban counts for both teams.
        - Once BANS_LOCKED or COMPLETED: all bans are revealed to everyone.
        """
        is_secret_phase = (
            match.status == "BAN_PHASE"
            and match.rules_snapshot.get("banOrder", "SIMULTANEOUS") == "SIMULTANEOUS"
            and not is_admin
        )

        home_bans = [b for b in match.bans if b.banning_team_id == match.home_team_id]
        away_bans = [b for b in match.bans if b.banning_team_id == match.away_team_id]

        def _format_ban(b: MatchBan) -> dict[str, Any]:
            ps = b.player_season
            return {
                "id": str(b.id),
                "banningTeamId": str(b.banning_team_id),
                "targetTeamId": str(b.target_team_id),
                "playerSeasonId": str(b.player_season_id),
                "playerName": ps.player.name if ps and ps.player else "",
                "position": ps.position if ps else "",
                "rating": ps.rating if ps else 0,
                "seasonCode": ps.season.code if ps and ps.season else "",
                "seasonBadgeUrl": ps.season.badge_url if ps and ps.season else None,
                "createdAt": b.created_at.isoformat(),
            }

        # Filter bans
        if is_secret_phase:
            if viewer_team_id == match.home_team_id:
                revealed_bans = [_format_ban(b) for b in home_bans]
            elif viewer_team_id == match.away_team_id:
                revealed_bans = [_format_ban(b) for b in away_bans]
            else:
                revealed_bans = []
        else:
            revealed_bans = [_format_ban(b) for b in match.bans]

        return {
            "id": str(match.id),
            "tournamentId": str(match.tournament_id),
            "status": match.status,
            "scheduledAt": match.scheduled_at.isoformat() if match.scheduled_at else None,
            "banStartedAt": match.ban_started_at.isoformat() if match.ban_started_at else None,
            "banExpiresAt": match.ban_expires_at.isoformat() if match.ban_expires_at else None,
            "version": match.version,
            "serverTime": self._clock.now().isoformat(),
            "rulesSnapshot": match.rules_snapshot,
            "homeTeam": {
                "id": str(match.home_team.id),
                "name": match.home_team.name,
                "confirmed": match.home_confirmed,
                "banCount": len(home_bans),
            },
            "awayTeam": {
                "id": str(match.away_team.id),
                "name": match.away_team.name,
                "confirmed": match.away_confirmed,
                "banCount": len(away_bans),
            },
            "bans": revealed_bans,
        }

    async def _broadcast_match_event(self, match: Match, event_type: str) -> None:
        """Broadcast match state to room outside transaction."""
        # For public broadcast, spectators view with masked secrets
        payload = self.build_match_view_dict(match, viewer_team_id=None, is_admin=False)
        payload["eventType"] = event_type
        await self._broadcaster.broadcast(match.id, payload)
