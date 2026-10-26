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
    LineBanLimitReached,
    MatchNotActive,
    MatchNotFound,
    NotYourTurn,
    PlayerAlreadyBanned,
    PlayerNotInRoster,
    SameTeamMatch,
    TeamNotFound,
    TeamNotInMatch,
    TournamentNotFound,
)
from app.match import repository
from app.match.broadcaster import MatchBroadcaster
from app.match.domain import Match, MatchBan, TeamStanding, calculate_standings
from app.player.position import LINE_LABELS, get_position_line
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

        rules = dict(match.rules_snapshot)
        turn_seconds = int(rules.get("banTimeSeconds", rules.get("ban_time_seconds", 180)))
        rules["ban_order"] = "ALTERNATING"
        rules["banOrder"] = "ALTERNATING"
        rules["homeTurnsSpent"] = 0
        rules["awayTurnsSpent"] = 0
        rules["banTurn"] = 1
        match.rules_snapshot = rules

        match.status = "BAN_PHASE"
        match.current_banning_team_id = match.home_team_id  # Đội nhà cấm trước
        match.ban_started_at = now
        match.ban_expires_at = now + timedelta(seconds=turn_seconds)
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

    async def reset_ban_phase(self, match_id: uuid.UUID) -> Match:
        """Reset match back to fresh BAN_PHASE (deletes existing bans for re-testing)."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))

        # Delete existing bans
        for b in list(match.bans):
            await self._session.delete(b)

        rules = dict(match.rules_snapshot)
        turn_seconds = int(rules.get("banTimeSeconds", rules.get("ban_time_seconds", 180)))
        rules["ban_order"] = "ALTERNATING"
        rules["banOrder"] = "ALTERNATING"
        rules["homeTurnsSpent"] = 0
        rules["awayTurnsSpent"] = 0
        rules["banTurn"] = 1
        match.rules_snapshot = rules

        match.status = "BAN_PHASE"
        match.current_banning_team_id = match.home_team_id
        match.ban_started_at = now
        match.ban_expires_at = now + timedelta(seconds=turn_seconds)
        match.home_confirmed = False
        match.away_confirmed = False
        match.home_score = None
        match.away_score = None
        match.completed_at = None
        match.version += 1
        match.updated_at = now
        await self._session.commit()

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
        is_admin: bool = False,
    ) -> MatchBan:
        """Submit a single player card ban under SELECT ... FOR UPDATE lock."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))

        if match.status != "BAN_PHASE":
            raise MatchNotActive()

        # Check turn in alternating mode strictly: each team only 1 pick per turn
        ban_order = match.rules_snapshot.get(
            "banOrder", match.rules_snapshot.get("ban_order", "ALTERNATING")
        )
        if ban_order == "ALTERNATING" and not match.is_team_turn(banning_team_id):
            raise NotYourTurn()

        if not match.is_participant(banning_team_id):
            raise TeamNotInMatch()

        if match.is_confirmed(banning_team_id):
            raise BansAlreadyConfirmed()

        # Resolve target team
        ban_target = match.rules_snapshot.get(
            "banTarget", match.rules_snapshot.get("ban_target", "OPPONENT_ROSTER")
        )
        resolved_target = (
            match.get_opponent_team_id(banning_team_id)
            if ban_target == "OPPONENT_ROSTER"
            else banning_team_id
        )

        # BR-M01: Target player must belong to the target team's drafted roster
        is_drafted = await repository.is_card_drafted_by_team(
            self._session, match.tournament_id, resolved_target, player_season_id
        )
        if not is_drafted:
            raise PlayerNotInRoster()

        # BR-M02: Check ban limit
        raw_max_bans = match.rules_snapshot.get(
            "banCount", match.rules_snapshot.get("ban_count", 5)
        )
        max_bans = int(raw_max_bans)
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

        # Check tactical line ban limit: maximum 2 players per line (FW, MF, DF)
        target_ps = await repository.get_player_season_by_id(self._session, player_season_id)
        if target_ps:
            target_line = get_position_line(target_ps.position)
            existing_line_bans = len(
                [
                    b
                    for b in match.bans
                    if b.banning_team_id == banning_team_id
                    and b.player_season
                    and get_position_line(b.player_season.position) == target_line
                ]
            )
            max_line_bans = int(match.rules_snapshot.get("max_line_bans", 2))
            if existing_line_bans >= max_line_bans:
                line_name = LINE_LABELS.get(target_line, target_line)
                raise LineBanLimitReached(line_name, max_line_bans)

        ban = MatchBan(
            id=uuid.uuid4(),
            match_id=match_id,
            banning_team_id=banning_team_id,
            target_team_id=resolved_target,
            player_season_id=player_season_id,
            created_at=now,
        )
        await repository.create_match_ban(self._session, ban)

        # Update turns spent in snapshot
        rules = dict(match.rules_snapshot)
        turn_seconds = int(rules.get("banTimeSeconds", rules.get("ban_time_seconds", 180)))

        if banning_team_id == match.home_team_id:
            rules["homeTurnsSpent"] = rules.get("homeTurnsSpent", 0) + 1
        else:
            rules["awayTurnsSpent"] = rules.get("awayTurnsSpent", 0) + 1
        rules["banTurn"] = rules.get("banTurn", 1) + 1
        match.rules_snapshot = rules

        # Count total bans for home and away
        home_bans_count = await repository.get_team_bans_count(
            self._session, match_id, match.home_team_id
        )
        away_bans_count = await repository.get_team_bans_count(
            self._session, match_id, match.away_team_id
        )

        # Check if both teams have completed their bans (or reached max_bans)
        if home_bans_count >= max_bans and away_bans_count >= max_bans:
            match.status = "BANS_LOCKED"
            match.current_banning_team_id = None
            match.home_confirmed = True
            match.away_confirmed = True
        else:
            next_team = match.get_opponent_team_id(banning_team_id)
            next_bans_count = (
                away_bans_count if next_team == match.away_team_id else home_bans_count
            )
            if next_bans_count >= max_bans:
                next_team = banning_team_id
            match.current_banning_team_id = next_team
            match.ban_expires_at = now + timedelta(seconds=turn_seconds)

        match.version += 1
        match.updated_at = now
        await self._session.commit()

        created_ban = await repository.get_match_ban_by_id(self._session, ban.id)
        assert created_ban is not None

        ps = created_ban.player_season
        banning_team_obj = (
            match.home_team if banning_team_id == match.home_team_id else match.away_team
        )
        last_banned_player = {
            "playerSeasonId": str(ps.id) if ps else str(player_season_id),
            "playerName": ps.player.name if ps and ps.player else "",
            "position": ps.position if ps else "",
            "rating": ps.rating if ps else 0,
            "salary": ps.salary if ps else 0,
            "imageUrl": ps.image_url if ps else None,
            "seasonCode": ps.season.code if ps and ps.season else "",
            "seasonBadgeUrl": ps.season.badge_url if ps and ps.season else None,
            "banningTeamId": str(banning_team_id),
            "banningTeamName": banning_team_obj.name if banning_team_obj else "",
        }

        # Broadcast state
        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(
            full_match,
            "BAN_SUBMITTED",
            extra_data={"lastBannedPlayer": last_banned_player},
        )
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
            full_match = await repository.get_match_by_id(self._session, match_id)
            if full_match:
                await self._broadcast_match_event(full_match, "BANS_LOCKED")
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

    async def skip_ban_turn(self, match_id: uuid.UUID) -> Match:
        """Skip current team's turn on timeout and advance turn to opponent (Skip turn)."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))
        if match.status != "BAN_PHASE":
            return match

        rules = dict(match.rules_snapshot)
        max_bans = int(rules.get("banCount", rules.get("ban_count", 5)))
        turn_seconds = int(rules.get("banTimeSeconds", rules.get("ban_time_seconds", 180)))

        current_team = match.get_effective_banning_team_id()
        if current_team == match.home_team_id:
            rules["homeTurnsSpent"] = rules.get("homeTurnsSpent", 0) + 1
        elif current_team == match.away_team_id:
            rules["awayTurnsSpent"] = rules.get("awayTurnsSpent", 0) + 1
        rules["banTurn"] = rules.get("banTurn", 1) + 1
        match.rules_snapshot = rules

        home_turns = rules.get("homeTurnsSpent", 0)
        away_turns = rules.get("awayTurnsSpent", 0)
        if home_turns >= max_bans and away_turns >= max_bans:
            match.status = "BANS_LOCKED"
            match.current_banning_team_id = None
            match.home_confirmed = True
            match.away_confirmed = True
            event_type = "BANS_LOCKED"
        else:
            next_team = (
                match.get_opponent_team_id(current_team)
                if current_team
                else match.home_team_id
            )
            if (next_team == match.home_team_id and home_turns >= max_bans) or (
                next_team == match.away_team_id and away_turns >= max_bans
            ):
                next_team = current_team or match.away_team_id
            match.current_banning_team_id = next_team
            match.ban_expires_at = now + timedelta(seconds=turn_seconds)
            event_type = "BAN_TURN_TIMEOUT"

        match.version += 1
        match.updated_at = now
        await self._session.commit()

        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(full_match, event_type)
        return full_match

    async def lock_expired_bans(self, match_id: uuid.UUID) -> bool:
        """Lock or skip expired ban turn (called by background timer loop)."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id)
        if match is None or match.status != "BAN_PHASE":
            return False

        if match.is_ban_phase_expired(now):
            await self.skip_ban_turn(match_id)
            return True
        return False

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

    async def record_score(
        self,
        match_id: uuid.UUID,
        home_score: int,
        away_score: int,
    ) -> Match:
        """Record match score and mark as COMPLETED (ADMIN only)."""
        now = self._clock.now()
        match = await repository.get_match_by_id(self._session, match_id, for_update=True)
        if match is None:
            raise MatchNotFound(str(match_id))

        match.home_score = home_score
        match.away_score = away_score
        match.status = "COMPLETED"
        match.completed_at = now
        match.version += 1
        match.updated_at = now
        await self._session.commit()

        full_match = await repository.get_match_by_id(self._session, match_id)
        assert full_match is not None
        await self._broadcast_match_event(full_match, "MATCH_COMPLETED")
        return full_match

    async def get_tournament_standings(
        self,
        tournament_id: uuid.UUID,
    ) -> list[TeamStanding]:
        """Fetch teams and matches for a tournament and compute leaderboard standings."""
        teams = await tournament_repo.list_teams(self._session, tournament_id)
        matches = await repository.list_matches_for_tournament(self._session, tournament_id)
        return calculate_standings(teams, matches)

    # ------------------------------------------------------------------
    # Secrecy Filtering & Snapshot Generation (BR-M04)
    # ------------------------------------------------------------------

    def build_match_view_dict(
        self,
        match: Match,
        viewer_team_id: uuid.UUID | None = None,
        is_admin: bool = False,
    ) -> dict[str, Any]:
        """Build dictionary representation respecting privacy and alternating rules."""
        ban_order = match.rules_snapshot.get(
            "banOrder", match.rules_snapshot.get("ban_order", "ALTERNATING")
        )
        is_secret_phase = (
            match.status == "BAN_PHASE" and ban_order == "SIMULTANEOUS" and not is_admin
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
                "salary": ps.salary if ps else 0,
                "imageUrl": ps.image_url if ps else None,
                "seasonCode": ps.season.code if ps and ps.season else "",
                "seasonBadgeUrl": ps.season.badge_url if ps and ps.season else None,
                "createdAt": b.created_at.isoformat(),
            }

        # Filter bans: in ALTERNATING mode, bans are immediately public
        if is_secret_phase:
            if viewer_team_id == match.home_team_id:
                revealed_bans = [_format_ban(b) for b in home_bans]
            elif viewer_team_id == match.away_team_id:
                revealed_bans = [_format_ban(b) for b in away_bans]
            else:
                revealed_bans = []
        else:
            revealed_bans = [_format_ban(b) for b in match.bans]

        eff_banning_team = match.get_effective_banning_team_id()

        return {
            "id": str(match.id),
            "tournamentId": str(match.tournament_id),
            "status": match.status,
            "scheduledAt": match.scheduled_at.isoformat() if match.scheduled_at else None,
            "banStartedAt": match.ban_started_at.isoformat() if match.ban_started_at else None,
            "banExpiresAt": match.ban_expires_at.isoformat() if match.ban_expires_at else None,
            "currentBanningTeamId": str(eff_banning_team) if eff_banning_team else None,
            "completedAt": match.completed_at.isoformat() if match.completed_at else None,
            "homeScore": match.home_score,
            "awayScore": match.away_score,
            "version": match.version,
            "serverTime": self._clock.now().isoformat(),
            "rulesSnapshot": match.rules_snapshot,
            "homeTeam": {
                "id": str(match.home_team.id),
                "name": match.home_team.name,
                "confirmed": match.home_confirmed,
                "banCount": len(home_bans),
                "score": match.home_score,
            },
            "awayTeam": {
                "id": str(match.away_team.id),
                "name": match.away_team.name,
                "confirmed": match.away_confirmed,
                "banCount": len(away_bans),
                "score": match.away_score,
            },
            "bans": revealed_bans,
        }

    async def _broadcast_match_event(
        self,
        match: Match,
        event_type: str,
        extra_data: dict[str, Any] | None = None,
    ) -> None:
        """Broadcast match state to room outside transaction."""
        payload = self.build_match_view_dict(match, viewer_team_id=None, is_admin=False)
        payload["eventType"] = event_type
        if extra_data:
            payload.update(extra_data)
        await self._broadcaster.broadcast(match.id, payload)
