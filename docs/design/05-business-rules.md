## 5. Business Rules

### 5.1 Tournament Rules

1. **BR-T01** A tournament can only have one DraftSession with status `WAITING`, `PICKING`, or `PAUSED` at any time (partial unique index).
2. **BR-T02** A draft can only be started when tournament status is `READY` (>= 2 teams registered) AND the pool has `>= teams.count * rules.rosterSize` ACTIVE `PlayerSeason` cards in the tournament's allowed seasons; otherwise → `DRAFT_POOL_TOO_SMALL` (422). Draft start resets `teams.budget_used = 0` for all teams in the tournament and copies rules into `draft_sessions.rules_snapshot`.
3. **BR-T03** Tournament rules are stored in `tournaments.rules` (JSONB) and validated by `TournamentRules` model (`rules_version`, `rosterSize` [1..60, default 24], `budget` [default 305], `pickTimeSeconds` [default 30], `uniqueBy` [PLAYER|CARD], `timeoutPolicy` [SKIP_TURN|AUTO_PICK_CHEAPEST], `allowedSeasonIds` [empty = all], `banCount` [default 5], `banTimeSeconds` [default 60], `banTarget` [OPPONENT_ROSTER|OWN_ROSTER], `banOrder` [SIMULTANEOUS|ALTERNATING]). Draft rules become immutable once draft starts.
4. **BR-T04** Multi-Season Pool: tournaments draw from the seasons specified in `allowedSeasonIds` (if empty, all seasons are allowed). Attempting to pick a card whose `seasonId` is not allowed returns `SEASON_NOT_ALLOWED` (422).
5. **BR-T05** Tournament status lifecycle transitions:
   - `DRAFT`: tournament created, fewer than 2 teams registered.
   - `READY`: automatically set when `>= 2` teams are registered, or when an active draft session is cancelled via `POST /api/drafts/{id}/cancel` (allowing draft re-start).
   - `RUNNING`: when draft starts (`POST /api/tournaments/{id}/draft/start`).
   - `COMPLETED`: set manually by ADMIN via `POST /api/tournaments/{id}/complete`.
   - `CANCELLED`: if tournament is cancelled.

### 5.2 Season & Import Rules

6. **BR-SI01** `Season` rows can be pre-created or auto-created during import when encountering an unseen `season_code`.
7. **BR-SI02** `UNIQUE(player_id, season_id)` — exactly one `PlayerSeason` per player per season card.
8. **BR-SI03** `players.external_player_id` is REQUIRED and `UNIQUE` — deduplication strictly by external source ID.
9. **BR-SI04** On re-import of an existing `(player_id, season_id)` pair, update in place (upsert).
10. **BR-SI05** Original game position strings are preserved without collapsing (no collapsing LWB/RWB or CF).
11. **BR-SI06** Player pool immutability during active draft: any attempt to import players (`POST /api/admin/players/import`) or modify player season salaries (`PATCH /api/admin/player-seasons/{id}`) while any draft session has status `PICKING` or `PAUSED` is rejected with `POOL_LOCKED` (422).
12. **BR-SI07** Player salary validation: `salary` must be an integer `>= 1` (enforced by Pydantic and database check constraint).

### 5.3 Pick Rules (one `async with session.begin()` + `with_for_update()`)

The whole pick operation runs in **one transaction** with a `SELECT … FOR UPDATE` lock on `DraftSession`.

11. **BR-P01** The DraftSession must exist; if not → `DRAFT_NOT_FOUND` (404).
12. **BR-P02** Session status must be `PICKING`; otherwise → `DRAFT_NOT_ACTIVE` (422) or `DRAFT_COMPLETED` (422).
13. **BR-P03** Request's `expectedVersion` must equal `draftSession.version`; otherwise → reject (stale client).
14. **BR-P04** If `now > turnExpiresAt` at time of processing: timeout is applied and COMMITTED in the SAME transaction (locking draft row, applying `TimeoutPolicy` to auto-pick or skip the turn, advancing turn, consuming turn, incrementing version, writing event). Only after exiting the `async with session.begin()` block, the outer layer raises `TURN_EXPIRED` (422). Never open a second transaction on the same draft row. Broadcast updated draft state after commit.
15. **BR-P05** `teamId` is resolved from the authenticated session user; client-supplied team is ignored. Resolved team must equal `currentTeamId` → `NOT_YOUR_TURN` (403).
16. **BR-P06** `PlayerSeason` must exist → `PLAYER_NOT_FOUND` (404).
17. **BR-P07** `PlayerSeason.seasonId` must be in `rules_snapshot.allowedSeasonIds` (unless empty) → `SEASON_NOT_ALLOWED` (422).
18. **BR-P08** Card availability & uniqueness:
    - Card must have status `ACTIVE` → `PLAYER_NOT_AVAILABLE` (422).
    - Card must not already be picked in this draft session (`UNIQUE(draft_session_id, player_season_id)`) → `PLAYER_ALREADY_PICKED` (409).
    - If `uniqueByPlayer` is TRUE: master player identity must not already be picked in this draft session (`UNIQUE(draft_session_id, player_id) WHERE unique_by_player`) → `PLAYER_ALREADY_PICKED` (409).
19. **BR-P09** `team.budgetUsed + playerSeason.salary <= tournament.budget` → `BUDGET_EXCEEDED` (422). `budgetRemaining` computed on backend.
20. **BR-P10** Team's current roster size < `rules_snapshot.rosterSize` → `TEAM_ROSTER_FULL` (422).
21. **BR-P11** Budget feasibility: `budgetRemaining - salary >= (slotsLeft - 1) * minSalaryInPool` → `BUDGET_INSUFFICIENT_FOR_ROSTER` (422). `slotsLeft = rosterSize - team.pickedCount`.
22. **BR-P12** On success: insert `DraftPick` (`player_id`, `unique_by_player`, `round`, `turnNumber`, `salary_at_pick`), increment `team.budgetUsed`, increment `version`, write `DraftEvent(PICK)`.
23. **BR-P13** Turn advancement: immediately advance turn to next team via `DraftOrderStrategy`.
    - After last team in round, `currentRound += 1` and wrap back to `draftOrder = 1`.
    - Skip teams whose roster is already full (`rosterSize`).
    - Draft transitions to `COMPLETED` when all teams reach `rosterSize` picks, max rounds finished, or when no ACTIVE unpicked `PlayerSeason` exists with `salary <=` any team's `budgetRemaining`. Writes `DraftEvent(COMPLETE)`.
24. **BR-P14** Reset `turnStartedAt = now`, `turnExpiresAt = now + pickTimeSeconds` using injected `Clock` when turn advances to a new team.
25. **BR-P15** After the transaction commits successfully, broadcast the new `DraftState` over WebSocket. **Never broadcast inside transaction.**

### 5.4 Timer Rules

26. **BR-TM01** A background task started in FastAPI `lifespan` loops approximately every 1 second:
    - Queries for `PICKING` drafts where `turnExpiresAt < now` and processes each in its own transaction.
    - Queries for `BAN_PHASE` matches where `banExpiresAt < now` and locks bans in its own transaction.
    DB-driven — survives server restarts. Clean shutdown on cancellation.
27. **BR-TM02** Timeout handler acquires `SELECT … FOR UPDATE` lock, re-checks `version` and expiry before acting.
28. **BR-TM03** Default `TimeoutPolicy = AutoPickCheapest`: on draft timeout, auto-picks cheapest valid ACTIVE card in allowed seasons for current turn. If none affordable, skips the turn (writes `DraftEvent(SKIP)`). In both cases, advances turn to next team and increments `version`. `SkipTurn` remains available as an alternative implementation.
29. **BR-TM04** **Pause**: `remainingMillis = turnExpiresAt - now`; status → `PAUSED`; increment `version`; write `DraftEvent(PAUSE)`.
30. **BR-TM05** **Resume**: `turnExpiresAt = now + remainingMillis`; clear `remainingMillis`; status → `PICKING`; increment `version`; write `DraftEvent(RESUME)`.

### 5.5 Matches & Bans Rules (replaces Squad Lock)

31. **BR-M01** Target player card must belong to the target team's drafted roster (`DraftPick` records in this tournament's draft); otherwise → `PLAYER_NOT_IN_ROSTER` (422).
32. **BR-M02** Max `banCount` per team (default 5, configured in `rules_snapshot.banCount`). Attempting to ban more than `banCount` cards returns `BAN_LIMIT_REACHED` (422).
33. **BR-M03** `banTarget`:
    - `OPPONENT_ROSTER` (default): `target_team_id` must be the opponent team in the match.
    - `OWN_ROSTER`: `target_team_id` must be the banning team itself.
34. **BR-M04** Simultaneous Mode Privacy (`banOrder == 'SIMULTANEOUS'`):
    - While match is in `BAN_PHASE`, each team can view its own pending bans, but can only see the **count** of bans made by the opponent team (`opponentBanCount`), NOT the banned player identities.
    - Spectators only see ban counts for each team during `BAN_PHASE`.
35. **BR-M05** Confirmation & Locking:
    - A team confirms its bans via `POST /api/matches/{id}/bans/confirm`. Once confirmed, the team cannot add or delete bans (`BANS_ALREADY_CONFIRMED` 422).
    - Match bans transition to `BANS_LOCKED` when **both teams confirm**, OR when `ban_expires_at < now` (timer expiry keeps whatever bans were made so far).
    - Upon entering `BANS_LOCKED`, all bans are revealed to both teams and spectators.
36. **BR-M06** Match Concurrency & Realtime:
    - Match and ban operations acquire `SELECT … FOR UPDATE` on the `matches` row.
    - Monotonically increasing `version` on `matches` table incremented under lock on every ban action.
    - Injected `Clock` used for `scheduled_at`, `ban_started_at`, `ban_expires_at`.
    - Broadcast state over WebSocket `/ws/matches/{id}` after transaction commits.

### 5.6 Security Rules

37. **BR-SEC01** `TEAM_USER` can only pick on their own team's turn in the draft.
38. **BR-SEC02** `TEAM_USER` can only submit, delete, and confirm bans for their own team in matches they participate in.
39. **BR-SEC03** `ADMIN` can: create tournaments (with rules), add teams, import players, create users (`POST /api/admin/users`), start/pause/resume/cancel drafts, create matches, start ban phases, complete matches, and complete tournaments (`POST /api/tournaments/{id}/complete`).
40. **BR-SEC04** Login creates a row in `sessions`. HttpOnly cookie holds only random token (`SameSite=Lax`, `Secure` in prod). Passwords hashed with `bcrypt` directly.
41. **BR-SEC05** WebSocket connections at `/ws/drafts/{draft_id}` and `/ws/matches/{match_id}` are authenticated using session cookie at handshake with `Origin` validation.

### 5.7 Error Code Reference

| Code                             | HTTP | Trigger                                                                     |
| -------------------------------- | ---- | --------------------------------------------------------------------------- |
| `DRAFT_NOT_FOUND`                | 404  | DraftSession does not exist                                                 |
| `DRAFT_NOT_ACTIVE`               | 422  | Session status is not PICKING                                               |
| `DRAFT_COMPLETED`                | 422  | Session already COMPLETED                                                   |
| `NOT_YOUR_TURN`                  | 403  | Authenticated team ≠ currentTeamId                                          |
| `PLAYER_NOT_FOUND`               | 404  | PlayerSeason does not exist                                                 |
| `PLAYER_NOT_AVAILABLE`           | 422  | PlayerSeason has status INACTIVE                                            |
| `SEASON_NOT_ALLOWED`             | 422  | Player card does not belong to tournament's allowed seasons                 |
| `PLAYER_ALREADY_PICKED`          | 409  | Card already picked, or player already picked when `uniqueBy=PLAYER`        |
| `BUDGET_EXCEEDED`                | 422  | Pick would exceed budget cap                                                |
| `BUDGET_INSUFFICIENT_FOR_ROSTER` | 422  | Not enough budget to fill remaining slots                                   |
| `TEAM_ROSTER_FULL`               | 422  | Team already has rosterSize picks                                           |
| `TURN_EXPIRED`                   | 422  | Turn timer expired before pick was processed                                |
| `DRAFT_POOL_TOO_SMALL`           | 422  | Allowed seasons lack >= teams * rosterSize ACTIVE cards                     |
| `MATCH_NOT_FOUND`                | 404  | Match does not exist                                                        |
| `MATCH_NOT_ACTIVE`               | 422  | Match status is not BAN_PHASE                                               |
| `PLAYER_NOT_IN_ROSTER`           | 422  | Banned player is not in target team's drafted roster                        |
| `BAN_LIMIT_REACHED`              | 422  | Team already reached maximum allowed bans (banCount)                        |
| `BANS_ALREADY_CONFIRMED`         | 422  | Team has already confirmed its bans and cannot modify                       |
| `BANS_LOCKED`                    | 422  | Match bans are locked and cannot be modified                                |
| `POOL_LOCKED`                    | 422  | Player pool or salary cannot be modified while draft is PICKING or PAUSED   |

**Error format:** `DomainError` base class (`code`, `http_status`, `message`) registered via FastAPI exception handlers. Response shape follows RFC 9457:

```json
{
  "type": "https://fifadraft.example.com/errors/not-your-turn",
  "title": "Not Your Turn",
  "status": 403,
  "code": "NOT_YOUR_TURN",
  "message": "It is not your team's turn to pick."
}
```

FastAPI's default Pydantic validation errors are converted to the same shape (no raw `422 Unprocessable Entity` from FastAPI leaking to clients). Unexpected exceptions return 500 with code `INTERNAL_ERROR` and a log entry containing a request ID. Stack traces are never returned.

---

