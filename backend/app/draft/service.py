"""Application service orchestrating Draft Engine business transactions."""

import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.domain import User
from app.common.clock import Clock
from app.common.errors import (
    BudgetExceeded,
    BudgetInsufficientForRoster,
    DraftCompleted,
    DraftNotActive,
    DraftNotFound,
    DraftPoolTooSmall,
    DraftVersionMismatch,
    DuplicateCardsInBatch,
    InvalidPickCount,
    NotYourTurn,
    PlayerAlreadyPicked,
    PlayerNotAvailable,
    PlayerNotFound,
    SeasonNotAllowed,
    TeamNotFound,
    TeamRosterFull,
    TournamentNotFound,
    TournamentNotReady,
    TurnExpired,
)
from app.draft import repository
from app.draft.broadcaster import DraftBroadcaster
from app.draft.domain import (
    DraftPick,
    DraftSession,
    LinearOrder,
    TeamDraftStatusData,
    TeamTurnInfo,
    get_picks_count_for_round,
    is_budget_feasible,
)
from app.player.domain import PlayerSeason
from app.tournament import repository as tournament_repo


class DraftService:
    """Coordinates draft lifecycle, atomic picks under lock, turn advancement, and timeouts."""

    def __init__(
        self,
        session: AsyncSession,
        clock: Clock,
        broadcaster: DraftBroadcaster,
    ) -> None:
        self._session = session
        self._clock = clock
        self._broadcaster = broadcaster

    # ------------------------------------------------------------------
    # Draft Lifecycle
    # ------------------------------------------------------------------

    async def start_draft(self, tournament_id: uuid.UUID) -> DraftSession:
        """Initialize and start a draft session for a READY tournament."""
        tournament = await tournament_repo.get_tournament_by_id(self._session, tournament_id)
        if tournament is None:
            raise TournamentNotFound(str(tournament_id))
        if tournament.status != "READY":
            raise TournamentNotReady()

        rules = tournament.rules
        raw_seasons = rules.get("allowedSeasonIds") or rules.get("allowed_season_ids")
        allowed_season_ids = [
            uuid.UUID(str(s)) for s in (raw_seasons if isinstance(raw_seasons, list) else [])
        ]
        roster_size = int(str(rules.get("rosterSize", rules.get("roster_size", 23))))
        raw_pick_time = rules.get("pickTimeSeconds", rules.get("pick_time_seconds", 30))
        pick_time_seconds = int(str(raw_pick_time))

        teams = await tournament_repo.list_teams(self._session, tournament_id)
        if len(teams) < 2:
            raise TournamentNotReady()

        # BR-T02: Check pool size >= teams.count * rules.rosterSize
        required_cards = len(teams) * roster_size
        available_cards = await repository.count_active_cards_in_pool(
            self._session, allowed_season_ids
        )
        if available_cards < required_cards:
            raise DraftPoolTooSmall(available=available_cards, required=required_cards)

        # Reset teams.budget_used = 0
        for team in teams:
            team.budget_used = 0
            await tournament_repo.save_team(self._session, team)

        sorted_teams = sorted(teams, key=lambda t: t.draft_order)
        first_team = sorted_teams[0]

        now: datetime = self._clock.now()
        tournament.status = "RUNNING"
        tournament.updated_at = now
        await tournament_repo.save_tournament(self._session, tournament)

        draft_session = DraftSession(
            id=uuid.uuid4(),
            tournament_id=tournament_id,
            status="PICKING",
            current_round=1,
            current_turn=1,
            current_team_id=first_team.id,
            turn_started_at=now,
            turn_expires_at=now + timedelta(seconds=pick_time_seconds),
            remaining_millis=None,
            rules_snapshot=tournament.rules,
            version=1,
            created_at=now,
        )
        await repository.create_draft_session(self._session, draft_session)

        await repository.record_draft_event(
            session=self._session,
            draft_session_id=draft_session.id,
            event_type="START",
            team_id=None,
            turn_number=1,
            payload={"rules": tournament.rules},
            created_at=now,
        )

        await self._session.commit()
        snapshot = await self._build_snapshot_dict(draft_session, now)
        await self._broadcaster.broadcast(draft_session.id, "DRAFT_STARTED", snapshot)
        return draft_session

    async def get_draft(self, draft_id: uuid.UUID) -> DraftSession:
        """Fetch a draft session or raise DraftNotFound."""
        draft = await repository.get_draft_session_by_id(self._session, draft_id)
        if draft is None:
            raise DraftNotFound(str(draft_id))
        return draft

    async def list_picks(self, draft_id: uuid.UUID) -> list[DraftPick]:
        """Fetch all picks for a draft session."""
        draft = await repository.get_draft_session_by_id(self._session, draft_id)
        if draft is None:
            raise DraftNotFound(str(draft_id))
        return await repository.list_draft_picks(self._session, draft_id)

    async def get_team_roster(self, team_id: uuid.UUID) -> list[DraftPick]:
        """Fetch all picks belonging to a team."""
        team = await tournament_repo.get_team_by_id(self._session, team_id)
        if team is None:
            raise TeamNotFound(str(team_id))
        return await repository.get_team_picks(self._session, team_id)

    async def get_draft_detail_data(
        self, draft_id: uuid.UUID
    ) -> tuple[DraftSession, list[TeamDraftStatusData], datetime]:
        """Fetch draft session and build current status for all participating teams."""
        draft = await self.get_draft(draft_id)
        tournament_teams = await tournament_repo.list_teams(self._session, draft.tournament_id)
        picks = await self.list_picks(draft_id)
        budget_cap = int(str(draft.rules_snapshot.get("budget", 305)))

        teams_status: list[TeamDraftStatusData] = []
        for team in sorted(tournament_teams, key=lambda t: t.draft_order):
            team_picks_count = sum(1 for p in picks if p.team_id == team.id)
            teams_status.append(
                TeamDraftStatusData(
                    id=team.id,
                    name=team.name,
                    draft_order=team.draft_order,
                    budget_used=team.budget_used,
                    budget_remaining=budget_cap - team.budget_used,
                    picked_count=team_picks_count,
                )
            )

        now = self._clock.now()
        return draft, teams_status, now

    async def get_latest_draft_for_tournament(
        self, tournament_id: uuid.UUID
    ) -> tuple[DraftSession, list[TeamDraftStatusData], datetime]:
        """Fetch latest draft session for tournament and build team status."""
        draft = await repository.get_latest_session_for_tournament(self._session, tournament_id)
        if draft is None:
            raise DraftNotFound(f"No draft session found for tournament {tournament_id}")
        return await self.get_draft_detail_data(draft.id)

    async def _build_snapshot_dict(
        self,
        draft: DraftSession,
        now: datetime,
        last_picked_card: PlayerSeason | None = None,
        picked_cards: Sequence[PlayerSeason] | None = None,
    ) -> dict[str, Any]:
        """Build full DraftState snapshot JSON matching design spec 6.8."""
        _, teams_status, _ = await self.get_draft_detail_data(draft.id)
        picked_player_dict = None
        picked_players_list: list[dict[str, Any]] = []

        cards_to_format: Sequence[PlayerSeason] = (
            picked_cards
            if picked_cards is not None
            else ([last_picked_card] if last_picked_card is not None else [])
        )
        for card in cards_to_format:
            season_info = None
            if card.season:
                season_info = {
                    "id": str(card.season.id),
                    "code": card.season.code,
                    "badgeUrl": card.season.badge_url,
                }
            item = {
                "playerSeasonId": str(card.id),
                "playerId": str(card.player_id),
                "name": card.player.name if card.player else "",
                "position": card.position,
                "rating": card.rating or 0,
                "salary": card.salary,
                "imageUrl": card.image_url,
                "externalPlayerId": (
                    card.player.external_player_id if card.player else None
                ),
                "season": season_info,
            }
            picked_players_list.append(item)

        if picked_players_list:
            picked_player_dict = picked_players_list[-1]

        current_team_status = next(
            (t for t in teams_status if t.id == draft.current_team_id), None
        )
        is_main_squad = (
            current_team_status.picked_count < 11
            if current_team_status
            else (draft.current_round <= 7)
        )

        return {
            "draftId": str(draft.id),
            "version": draft.version,
            "serverTime": now.isoformat(),
            "status": draft.status,
            "currentRound": draft.current_round,
            "currentTurn": draft.current_turn,
            "currentTeamId": str(draft.current_team_id) if draft.current_team_id else None,
            "turnStartedAt": draft.turn_started_at.isoformat() if draft.turn_started_at else None,
            "turnExpiresAt": draft.turn_expires_at.isoformat() if draft.turn_expires_at else None,
            "remainingMillis": draft.remaining_millis,
            "requiredPicks": get_picks_count_for_round(draft.current_round),
            "isMainSquad": is_main_squad,
            "pickedPlayer": picked_player_dict,
            "pickedPlayers": picked_players_list,
            "teams": [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "draftOrder": t.draft_order,
                    "budgetUsed": t.budget_used,
                    "budgetRemaining": t.budget_remaining,
                    "pickedCount": t.picked_count,
                }
                for t in teams_status
            ],
        }

    async def get_draft_snapshot_dict(
        self, draft_id: uuid.UUID, event_type: str = "INITIAL_SNAPSHOT"
    ) -> dict[str, Any] | None:
        """Build a full snapshot dictionary for WebSocket client initial handshake."""
        draft = await repository.get_draft_session_by_id(self._session, draft_id)
        if draft is None:
            return None
        now = self._clock.now()
        snapshot = await self._build_snapshot_dict(draft, now)
        snapshot["eventType"] = event_type
        return snapshot

    async def is_user_authorized_for_draft(self, user: User, draft_id: uuid.UUID) -> bool:
        """Check if user has permission to join the draft room."""
        if user.role == "ADMIN":
            return True
        if user.role == "TEAM_USER" and user.team_id is not None:
            draft = await repository.get_draft_session_by_id(self._session, draft_id)
            if draft is None:
                return False
            team = await tournament_repo.get_team_by_id(self._session, user.team_id)
            if team and team.tournament_id == draft.tournament_id:
                return True
        return False

    # ------------------------------------------------------------------
    # Atomic Pick Transaction (BR-P01..BR-P15)
    # ------------------------------------------------------------------

    async def make_pick(
        self,
        draft_id: uuid.UUID,
        team_id: uuid.UUID,
        player_season_ids: Sequence[uuid.UUID] | None = None,
        player_season_id: uuid.UUID | None = None,
        expected_version: int = 1,
    ) -> tuple[list[DraftPick], DraftSession]:
        """Process one or more card picks with SELECT ... FOR UPDATE lock on DraftSession."""
        # BR-P01: DraftSession must exist with exclusive lock
        draft = await repository.get_draft_session_by_id(self._session, draft_id, for_update=True)
        if draft is None:
            raise DraftNotFound(str(draft_id))

        # BR-P02: Must be in PICKING status
        if draft.status == "COMPLETED":
            raise DraftCompleted()
        if draft.status != "PICKING":
            raise DraftNotActive()

        # BR-P03: Version check
        if draft.version != expected_version:
            raise DraftVersionMismatch(expected=expected_version, current=draft.version)

        # BR-P04: Timeout check. If now >= turn_expires_at, apply timeout in SAME tx,
        now: datetime = self._clock.now()
        if draft.turn_expires_at and now >= draft.turn_expires_at:
            chosen_cards = await self._apply_timeout_under_lock(draft, now)
            draft.version += 1
            await repository.save_draft_session(self._session, draft)
            await self._session.commit()
            event_type = "TIMEOUT_AUTO_PICK" if chosen_cards else "TURN_SKIPPED"
            if draft.status == "COMPLETED":
                event_type = "DRAFT_COMPLETED"
            snapshot = await self._build_snapshot_dict(
                draft, now, picked_cards=chosen_cards
            )
            await self._broadcaster.broadcast(draft.id, event_type, snapshot)
            raise TurnExpired()

        # BR-P05: Turn check
        if draft.current_team_id != team_id:
            raise NotYourTurn()

        # Normalize card IDs
        card_ids: list[uuid.UUID] = (
            list(player_season_ids)
            if player_season_ids is not None and len(player_season_ids) > 0
            else ([player_season_id] if player_season_id is not None else [])
        )

        required_picks = get_picks_count_for_round(draft.current_round)
        if len(card_ids) != required_picks:
            raise InvalidPickCount(expected=required_picks, received=len(card_ids))

        if len(set(card_ids)) != len(card_ids):
            raise DuplicateCardsInBatch()

        rules = draft.rules_snapshot
        raw_seasons = rules.get("allowedSeasonIds") or rules.get("allowed_season_ids")
        allowed_season_ids = [
            uuid.UUID(str(s)) for s in (raw_seasons if isinstance(raw_seasons, list) else [])
        ]
        unique_by = str(rules.get("uniqueBy") or rules.get("unique_by") or "PLAYER")
        unique_by_player = unique_by == "PLAYER"
        budget_cap = int(str(rules.get("budget", 305)))
        roster_size = int(str(rules.get("rosterSize", rules.get("roster_size", 23))))

        # BR-P06, BR-P07, BR-P08: Fetch and validate all cards in batch
        cards: list[PlayerSeason] = []
        for cid in card_ids:
            card = await repository.get_player_season_by_id(self._session, cid)
            if card is None:
                raise PlayerNotFound(str(cid))
            if card.status != "ACTIVE":
                raise PlayerNotAvailable()
            if allowed_season_ids and card.season_id not in allowed_season_ids:
                raise SeasonNotAllowed()
            cards.append(card)

        # Uniqueness checks across previous picks
        picked_cards = await repository.get_picked_player_season_ids(self._session, draft.id)
        for card in cards:
            if card.id in picked_cards:
                raise PlayerAlreadyPicked()

        if unique_by_player:
            picked_players = await repository.get_picked_player_ids(self._session, draft.id)
            batch_player_ids: list[uuid.UUID] = []
            for card in cards:
                if card.player_id in picked_players or card.player_id in batch_player_ids:
                    raise PlayerAlreadyPicked()
                batch_player_ids.append(card.player_id)

        # Team roster full check
        team = await tournament_repo.get_team_by_id(self._session, team_id)
        assert team is not None  # current_team_id comes from DB FK

        team_picks = await repository.get_team_picks(
            self._session, team_id, draft_session_id=draft.id
        )
        picked_count = len(team_picks)

        if picked_count + len(cards) > roster_size:
            raise TeamRosterFull()

        # Budget constraints apply only to cards filling the 11 starting slots
        main_cards = [
            card for idx, card in enumerate(cards) if picked_count + idx < 11
        ]
        if main_cards:
            main_salary = sum(c.salary for c in main_cards)
            if team.budget_used + main_salary > budget_cap:
                raise BudgetExceeded()

            slots_left_after = 11 - (picked_count + len(main_cards))
            budget_remaining_after = budget_cap - (team.budget_used + main_salary)
            min_salary = await repository.get_min_salary_in_pool(self._session, allowed_season_ids)
            if budget_remaining_after < slots_left_after * max(1, min_salary):
                raise BudgetInsufficientForRoster()

        # Insert DraftPicks
        created_picks: list[DraftPick] = []
        for card in cards:
            pick = DraftPick(
                id=uuid.uuid4(),
                draft_session_id=draft.id,
                team_id=team_id,
                player_season_id=card.id,
                player_id=card.player_id,
                unique_by_player=unique_by_player,
                round=draft.current_round,
                turn_number=draft.current_turn,
                salary_at_pick=card.salary,
                picked_at=now,
            )
            await repository.create_draft_pick(self._session, pick)
            created_picks.append(pick)

        if main_cards:
            team.budget_used += sum(c.salary for c in main_cards)
            await tournament_repo.save_team(self._session, team)

        await repository.record_draft_event(
            session=self._session,
            draft_session_id=draft.id,
            event_type="PICK",
            team_id=team_id,
            turn_number=draft.current_turn,
            payload={
                "pick_ids": [str(p.id) for p in created_picks],
                "player_season_ids": [str(c.id) for c in cards],
                "salaries": [c.salary for c in cards],
                "round": draft.current_round,
            },
            created_at=now,
        )

        # Advance turn
        await self._advance_turn_under_lock(draft, now)

        draft.version += 1
        await repository.save_draft_session(self._session, draft)

        # Commit transaction before broadcast
        await self._session.commit()
        event_type = "DRAFT_COMPLETED" if draft.status == "COMPLETED" else "PICK_MADE"
        snapshot = await self._build_snapshot_dict(
            draft, now, last_picked_card=cards[-1], picked_cards=cards
        )
        await self._broadcaster.broadcast(draft.id, event_type, snapshot)

        return created_picks, draft

    # ------------------------------------------------------------------
    # Pause, Resume, Cancel
    # ------------------------------------------------------------------

    async def pause_draft(self, draft_id: uuid.UUID) -> DraftSession:
        """Pause a draft session and record remaining time."""
        draft = await repository.get_draft_session_by_id(self._session, draft_id, for_update=True)
        if draft is None:
            raise DraftNotFound(str(draft_id))
        if draft.status != "PICKING":
            raise DraftNotActive()

        now: datetime = self._clock.now()
        remaining_millis = 0
        if draft.turn_expires_at and draft.turn_expires_at > now:
            remaining_millis = int((draft.turn_expires_at - now).total_seconds() * 1000)

        draft.remaining_millis = remaining_millis
        draft.status = "PAUSED"
        draft.version += 1
        await repository.save_draft_session(self._session, draft)

        await repository.record_draft_event(
            session=self._session,
            draft_session_id=draft.id,
            event_type="PAUSE",
            team_id=draft.current_team_id,
            turn_number=draft.current_turn,
            payload={"remaining_millis": remaining_millis},
            created_at=now,
        )

        await self._session.commit()
        snapshot = await self._build_snapshot_dict(draft, now)
        await self._broadcaster.broadcast(draft.id, "DRAFT_PAUSED", snapshot)
        return draft

    async def resume_draft(self, draft_id: uuid.UUID) -> DraftSession:
        """Resume a paused draft session."""
        draft = await repository.get_draft_session_by_id(self._session, draft_id, for_update=True)
        if draft is None:
            raise DraftNotFound(str(draft_id))
        if draft.status != "PAUSED":
            raise DraftNotActive()

        now: datetime = self._clock.now()
        remaining_seconds = (draft.remaining_millis or 0) / 1000.0
        draft.turn_started_at = now
        draft.turn_expires_at = now + timedelta(seconds=remaining_seconds)
        draft.remaining_millis = None
        draft.status = "PICKING"
        draft.version += 1
        await repository.save_draft_session(self._session, draft)

        await repository.record_draft_event(
            session=self._session,
            draft_session_id=draft.id,
            event_type="RESUME",
            team_id=draft.current_team_id,
            turn_number=draft.current_turn,
            payload={},
            created_at=now,
        )

        await self._session.commit()
        snapshot = await self._build_snapshot_dict(draft, now)
        await self._broadcaster.broadcast(draft.id, "DRAFT_RESUMED", snapshot)
        return draft

    async def cancel_draft(self, draft_id: uuid.UUID) -> DraftSession:
        """Cancel a draft session and return the tournament to READY."""
        draft = await repository.get_draft_session_by_id(self._session, draft_id, for_update=True)
        if draft is None:
            raise DraftNotFound(str(draft_id))
        if draft.status not in ("PICKING", "PAUSED"):
            raise DraftNotActive()

        now: datetime = self._clock.now()
        draft.status = "CANCELLED"
        draft.version += 1
        await repository.save_draft_session(self._session, draft)

        # Restore tournament status to READY
        tournament = await tournament_repo.get_tournament_by_id(self._session, draft.tournament_id)
        if tournament:
            tournament.status = "READY"
            tournament.updated_at = now
            await tournament_repo.save_tournament(self._session, tournament)

        # Reset teams.budget_used = 0 for all teams in tournament
        teams = await tournament_repo.list_teams(self._session, draft.tournament_id)
        for t in teams:
            t.budget_used = 0
            await tournament_repo.save_team(self._session, t)

        # Delete picks belonging to this cancelled draft session
        await repository.delete_draft_picks_by_session(self._session, draft.id)

        await repository.record_draft_event(
            session=self._session,
            draft_session_id=draft.id,
            event_type="CANCEL",
            team_id=draft.current_team_id,
            turn_number=draft.current_turn,
            payload={},
            created_at=now,
        )

        await self._session.commit()
        snapshot = await self._build_snapshot_dict(draft, now)
        await self._broadcaster.broadcast(draft.id, "DRAFT_CANCELLED", snapshot)
        return draft

    async def apply_timeout(self, draft_id: uuid.UUID) -> DraftSession:
        """Process turn timeout under lock if turn has expired."""
        draft = await repository.get_draft_session_by_id(self._session, draft_id, for_update=True)
        if draft is None:
            raise DraftNotFound(str(draft_id))
        if draft.status != "PICKING":
            return draft

        now: datetime = self._clock.now()
        if draft.turn_expires_at and now >= draft.turn_expires_at:
            chosen_cards = await self._apply_timeout_under_lock(draft, now)
            draft.version += 1
            await repository.save_draft_session(self._session, draft)
            await self._session.commit()
            event_type = "TIMEOUT_AUTO_PICK" if chosen_cards else "TURN_SKIPPED"
            if draft.status == "COMPLETED":
                event_type = "DRAFT_COMPLETED"
            snapshot = await self._build_snapshot_dict(
                draft, now, picked_cards=chosen_cards
            )
            await self._broadcaster.broadcast(draft.id, event_type, snapshot)
        return draft

    # ------------------------------------------------------------------
    # Private Helpers (called while holding DraftSession row lock)
    # ------------------------------------------------------------------

    async def _advance_turn_under_lock(self, draft: DraftSession, now: datetime) -> None:
        """Compute the next turn, advance round, or complete the draft."""
        rules = draft.rules_snapshot
        roster_size = int(str(rules.get("rosterSize", rules.get("roster_size", 23))))
        raw_pick_time = rules.get("pickTimeSeconds", rules.get("pick_time_seconds", 30))
        pick_time_seconds = int(str(raw_pick_time))
        budget_cap = int(str(rules.get("budget", 305)))

        teams = await tournament_repo.list_teams(self._session, draft.tournament_id)
        team_turn_infos: list[TeamTurnInfo] = []
        for t in teams:
            t_picks = await repository.get_team_picks(
                self._session, t.id, draft_session_id=draft.id
            )
            team_turn_infos.append(
                TeamTurnInfo(
                    team_id=t.id,
                    draft_order=t.draft_order,
                    picked_count=len(t_picks),
                    budget_remaining=budget_cap - t.budget_used,
                )
            )

        strategy = LinearOrder()
        result = strategy.next_turn(
            teams=team_turn_infos,
            current_team_id=draft.current_team_id,
            current_round=draft.current_round,
            roster_size=roster_size,
        )

        if result.is_completed:
            draft.status = "COMPLETED"
            draft.completed_at = now
            draft.current_team_id = None
            draft.turn_started_at = None
            draft.turn_expires_at = None
            await repository.record_draft_event(
                session=self._session,
                draft_session_id=draft.id,
                event_type="COMPLETE",
                team_id=None,
                turn_number=draft.current_turn,
                payload={"round": draft.current_round},
                created_at=now,
            )
        else:
            draft.current_round = result.next_round
            draft.current_turn += 1
            draft.current_team_id = result.next_team_id
            draft.turn_started_at = now
            draft.turn_expires_at = now + timedelta(seconds=pick_time_seconds)

    async def _apply_timeout_under_lock(
        self, draft: DraftSession, now: datetime
    ) -> list[PlayerSeason]:
        """Execute the timeout policy for the current turn (auto-pick or skip)."""
        rules = draft.rules_snapshot
        timeout_policy = str(
            rules.get("timeoutPolicy") or rules.get("timeout_policy") or "SKIP_TURN"
        )
        unique_by = str(rules.get("uniqueBy") or rules.get("unique_by") or "PLAYER")
        unique_by_player = unique_by == "PLAYER"
        budget_cap = int(str(rules.get("budget", 305)))
        raw_seasons = rules.get("allowedSeasonIds") or rules.get("allowed_season_ids")
        allowed_season_ids = [
            uuid.UUID(str(s)) for s in (raw_seasons if isinstance(raw_seasons, list) else [])
        ]
        required_picks = get_picks_count_for_round(draft.current_round)
        chosen_cards: list[PlayerSeason] = []

        if timeout_policy == "AUTO_PICK_CHEAPEST" and draft.current_team_id is not None:
            team = await tournament_repo.get_team_by_id(self._session, draft.current_team_id)
            if team:
                for _ in range(required_picks):
                    team_picks = await repository.get_team_picks(
                        self._session, team.id, draft_session_id=draft.id
                    )
                    picked_count = len(team_picks)

                    if picked_count < 11:
                        slots_left = 11 - picked_count
                        budget_remaining = budget_cap - team.budget_used
                        min_salary = await repository.get_min_salary_in_pool(
                            self._session, allowed_season_ids
                        )
                        max_salary = budget_remaining
                    else:
                        slots_left = 0
                        budget_remaining = 0
                        min_salary = 1
                        max_salary = 999999999  # No budget limit for substitute players

                    candidates = await repository.find_available_cards_for_autopick(
                        session=self._session,
                        draft_session_id=draft.id,
                        allowed_season_ids=allowed_season_ids,
                        unique_by_player=unique_by_player,
                        max_salary=max_salary,
                    )

                    chosen_card: PlayerSeason | None = None
                    chosen_card_ids = {c.id for c in chosen_cards}
                    chosen_player_ids = (
                        {c.player_id for c in chosen_cards} if unique_by_player else set()
                    )

                    if picked_count < 11:
                        for card in candidates:
                            if card.id in chosen_card_ids:
                                continue
                            if unique_by_player and card.player_id in chosen_player_ids:
                                continue
                            if is_budget_feasible(
                                budget_remaining, card.salary, slots_left, min_salary
                            ):
                                chosen_card = card
                                break
                    else:
                        for card in candidates:
                            if card.id in chosen_card_ids:
                                continue
                            if unique_by_player and card.player_id in chosen_player_ids:
                                continue
                            chosen_card = card
                            break

                    if chosen_card is not None:
                        chosen_cards.append(chosen_card)
                        pick = DraftPick(
                            id=uuid.uuid4(),
                            draft_session_id=draft.id,
                            team_id=team.id,
                            player_season_id=chosen_card.id,
                            player_id=chosen_card.player_id,
                            unique_by_player=unique_by_player,
                            round=draft.current_round,
                            turn_number=draft.current_turn,
                            salary_at_pick=chosen_card.salary,
                            picked_at=now,
                        )
                        await repository.create_draft_pick(self._session, pick)
                        if picked_count < 11:
                            team.budget_used += chosen_card.salary
                            await tournament_repo.save_team(self._session, team)

                        await repository.record_draft_event(
                            session=self._session,
                            draft_session_id=draft.id,
                            event_type="TIMEOUT",
                            team_id=team.id,
                            turn_number=draft.current_turn,
                            payload={
                                "auto_picked": True,
                                "pick_id": str(pick.id),
                                "player_season_id": str(chosen_card.id),
                                "salary": chosen_card.salary,
                            },
                            created_at=now,
                        )

        if not chosen_cards:
            # Fallback if no affordable card found or policy is SKIP_TURN
            await repository.record_draft_event(
                session=self._session,
                draft_session_id=draft.id,
                event_type="SKIP",
                team_id=draft.current_team_id,
                turn_number=draft.current_turn,
                payload={"reason": "TIMEOUT_SKIP", "round": draft.current_round},
                created_at=now,
            )

        await self._advance_turn_under_lock(draft, now)
        return chosen_cards
