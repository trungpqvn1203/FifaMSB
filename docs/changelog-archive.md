# Changelog Archive

> Các revision cũ đã được chuyển vào đây để giảm token khi AI đọc context.
> CHANGELOG hiện tại: `docs/CHANGELOG.md`


## [Phase 0 Revision 3] — 2026-09-19

### Player Name Search
- **GIN Trigram + Unaccent Index**: Restored GIN index with `pg_trgm + unaccent` on `players.name` for player name search (`GET /api/player-seasons?search=`).
- **Immutable Wrapper Requirement**: Documented that PostgreSQL's native `unaccent(text)` is not marked `IMMUTABLE`; the Alembic migration must create an immutable wrapper function (`immutable_unaccent(text)`) and index on it.
- **Importer Discipline**: Re-affirmed that the importer module still must NOT use fuzzy matching (deduplication remains strictly by `externalPlayerId`).
- Updated Key Database Constraints table, Database Rules in `AGENTS.md`, and query parameter documentation in `GET /api/player-seasons`.

### Roster Completeness & Goalkeeper Rules
- **Default TimeoutPolicy (`AutoPickCheapest`)**: Changed default `TimeoutPolicy` from `SkipTurn` to `AutoPickCheapest`. On turn timeout, the system automatically picks the cheapest ACTIVE unpicked `PlayerSeason` satisfying all pick rules, prioritizing a GK if the team currently has no GK. Falls back to a skip turn (writing `DraftEvent(SKIP)`) only if no valid player is affordable. `SkipTurn` remains available as an alternative implementation. (Updated `BR-TM03`, state machine diagram, state descriptions, Turn Advance Logic, and tests list).
- **BR-P16 (Goalkeeper Mandate on Final Slot)**: Added rule `BR-P16`: If a team has no GK in its roster and this is its last roster slot (`slotsLeft == 1`), the pick must be a GK; otherwise returns `MUST_PICK_GOALKEEPER` (422).
- **BR-P11 (Budget Feasibility GK Reservation)**: While a team still needs a GK (`gkCount == 0` and picking an outfield player), budget feasibility must reserve the cheapest available GK salary: `budgetRemaining - salary >= minGkSalaryInPool + (slotsLeft - 2) * minSalaryInPool`.
- **Tournament Constraints & Pool Validation**:
  - Tournament creation requires `maxPlayersPerTeam >= 11` (the formation size).
  - Draft start (`POST /api/tournaments/{id}/draft/start`) requires at least `teams.count * maxPlayersPerTeam` ACTIVE `PlayerSeason` records in the tournament's season, with at least one GK per team (`count(ACTIVE GK) >= teams.count`); otherwise returns `DRAFT_POOL_TOO_SMALL` (422). (Updated `BR-T02`, `BR-T03`, `OQ-9`, and error table).

### Transaction Handling on Pick Timeout (BR-P04)
- **Same Transaction for Timeout**: Clarified that when handling an expired turn (`now > turnExpiresAt`) during a pick, the timeout is applied and committed in the **SAME transaction** holding the row lock.
- **No Self-Deadlock**: Never open a second transaction on the same draft row. After exiting the `async with session.begin()` block, the outer layer raises `TURN_EXPIRED` (422). Updated `BR-P04` in `design.md` and Pick Rules Step 4 in `AGENTS.md`.

### Draft Cancellation & Budget Reset
- **Draft Cancellation Lifecycle**: When an active draft is cancelled via `POST /api/drafts/{id}/cancel` (ADMIN), the tournament status transitions back to `READY` (allowing a new draft to be started), while the cancelled `DraftSession` record is preserved in the database as audit history.
- **Budget Reset on Draft Start**: `POST /api/tournaments/{id}/draft/start` resets `teams.budget_used = 0` for all teams in the tournament. (Updated tournament status lifecycle, `BR-T05`, state descriptions, and endpoint documentation).

### Stale Reference Fix
- Fixed stale reference in `SquadPlayer` design rationale in `docs/design.md` from `BR-S05` to `BR-S02g`.

---

## [Phase 0 Revision 2] — 2026-09-19

### Domain & Business Rules
- **Draft Termination**: Each team gets exactly `maxPlayersPerTeam` turns. A skipped turn consumes a turn for that team. The draft transitions to `COMPLETED` after `maxPlayersPerTeam` rounds, or earlier if all team rosters are full or no ACTIVE unpicked `PlayerSeason` exists with `salary <=` any team's `budgetRemaining`. (Updated state machine, Turn Advance Logic, and BR-P13).
- **BR-P04 (Timeout Handling during Pick)**: When a pick request arrives for an expired turn (`now > turnExpiresAt`), the timeout is applied and COMMITTED first in its own transaction (advancing turn, writing SKIP event, incrementing version). Only after that commit succeeds is `TURN_EXPIRED` (422) returned to the client. Broadcast of the updated draft state occurs after that commit. DomainError is never raised inside the timeout transaction to avoid rollback.
- **Error Codes**: Added `PLAYER_NOT_AVAILABLE` (422) for INACTIVE `PlayerSeason`. Kept `PLAYER_ALREADY_PICKED` (409) strictly for players already picked in the draft session.
- **Formations**: Replaced `{"4-3-3": 11}` with a data-driven dictionary mapping formation name to an ordered list of slot names:
  `{"4-3-3": ["GK", "LB", "CB1", "CB2", "RB", "CM1", "CM2", "CM3", "LW", "ST", "RW"]}`.
  `formationPosition` must be one of the slot names. Only the `GK` slot accepts a player with `position = GK`, and the `GK` slot must be filled by a GK. Outfield slots have no position restriction (cannot be filled by a GK).
- **Draft Version Tracking**: Added `version INT NOT NULL` (default 0) to `draft_sessions` table (ERD + constraints). Incremented under the row lock (`SELECT ... FOR UPDATE`) on every state change (`pick`, `skip`, `pause`, `resume`, `complete`, `cancel`). Included in `GET /api/drafts/{id}` and all WebSocket messages. In WebSocket messages, `pickedPlayer` is `null` for non-pick events.
- **Squad Auto-Creation**: When a draft completes, a `Squad` is automatically created for each team in the tournament with default formation, `status = 'EDITING'`, and all picked players initialized with `squadRole = 'SUBSTITUTE'` and `formationPosition = null`.
- **Tournament Status Lifecycle**: `DRAFT` (< 2 teams) → `READY` (when >= 2 teams exist) → `RUNNING` (when draft starts) → `COMPLETED` (when all squads are `LOCKED`). BR-T02 changed to require >= 2 teams before starting draft.
- **Importer Deduplication**: Removed `pg_trgm` fuzzy name matching. `externalPlayerId` is strictly REQUIRED; rows without it are skipped and reported in the import report.

### API Endpoints Added / Updated
- `POST /api/admin/users`: Creates a `TEAM_USER` linked to a `teamId` (ADMIN only).
- `POST /api/teams/{id}/squad/unlock`: Unlocks a `LOCKED` squad back to `EDITING` (ADMIN only).
- `POST /api/drafts/{id}/cancel`: Cancels an active draft from `PICKING` or `PAUSED` status (ADMIN only).
- `GET /api/tournaments/{id}`: Added `draftId` to response.

### Example Data Consistency
- Default tournament budget set to `300` across all examples.
- Player salaries aligned to tier mapping between `5` and `60`.
- Ensured no player is picked twice across examples (e.g., Son Heung-min picked once in turn 7 by team-003, Alisson Becker picked in turn 1 by team-001 Alpha FC). Squad players align with team picks.

---

## [Phase 0 Revision 1] — 2026-09-19 (Stack Migration Java/Spring → Python/FastAPI)

### Stack & Framework (major)

| Area                        | Old (Java/Spring)                                 | New (Python/FastAPI)                                        |
| --------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Language & runtime          | Java 17, Spring Boot 3                            | Python 3.12, FastAPI + Uvicorn                              |
| Package manager             | Maven / Gradle                                    | uv (`pyproject.toml`, `uv.lock`)                            |
| ORM                         | Spring Data JPA / Hibernate                       | SQLAlchemy 2.0 async (`AsyncSession`) + asyncpg             |
| Migrations                  | Flyway                                            | Alembic                                                     |
| Password hashing            | Spring Security BCryptPasswordEncoder             | `bcrypt` package directly (no passlib)                      |
| Transaction annotation      | `@Transactional` + `PESSIMISTIC_WRITE`            | `async with session.begin()` + `with_for_update()`          |
| Scheduled timer             | `@Scheduled(fixedDelay=1000)`                     | FastAPI `lifespan` background task (asyncio loop)           |
| WebSocket broadcast trigger | `@TransactionalEventListener(phase=AFTER_COMMIT)` | Explicit `await broadcast()` after `await session.commit()` |
| Integrity error type        | `DataIntegrityViolationException`                 | SQLAlchemy `IntegrityError` (mapped by constraint name)     |
| Layer enforcement           | ArchUnit                                          | `import-linter` in CI                                       |
| Clock injection             | `java.time.Clock` (interface)                     | `Clock` Python Protocol with `now() -> datetime`            |
| Forbidden direct time call  | `Instant.now()` / `Clock.systemUTC()`             | `datetime.now()` / `datetime.utcnow()`                      |
| DTO style                   | Java records (no Lombok)                          | Pydantic v2 models                                          |
| Lint / format               | Checkstyle / SpotBugs                             | ruff                                                        |
| Type checking               | —                                                 | mypy --strict                                               |
| Test framework              | JUnit 5 / Testcontainers (Java)                   | pytest + pytest-asyncio + testcontainers-python             |
| HTTP test client            | MockMvc / RestAssured                             | httpx `AsyncClient`                                         |
| In-memory DB for tests      | H2 (forbidden in new)                             | Forbidden — real PostgreSQL via testcontainers              |
| Frontend WebSocket          | STOMP over SockJS                                 | Native WebSocket (no STOMP)                                 |

### API Paths (changed)

| Old endpoint                                              | New endpoint                                                        | Reason                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/seasons/{seasonId}/players/import` (JSON body) | `POST /api/admin/players/import` (multipart CSV + `seasonId` field) | AGENTS.md specifies multipart CSV; import is an admin-only operation |
| `GET /api/players?seasonId=...`                           | `GET /api/player-seasons?seasonId=...`                              | Resource is PlayerSeason, not Player                                 |
| `GET /api/players/{playerSeasonId}`                       | `GET /api/player-seasons/{id}`                                      | Consistent with above                                                |

### WebSocket (changed)

| Old                                                                     | New                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `ws://localhost:8080/ws` + STOMP subscribe to `/topic/drafts/{draftId}` | `ws://localhost:8080/ws/drafts/{draft_id}` (plain JSON) |
| SockJS fallback                                                         | No fallback — native WebSocket only                     |
| STOMP heartbeat                                                         | Application-level ping/heartbeat frame from server      |

### ERD (additive)

| Change                 | Detail                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSIONS` table added | `id` (random token, PK), `user_id` (FK), `expires_at`, `created_at`. Replaces in-memory/Spring Security session management. Required by AGENTS.md. |

### Business Rules (wording updated, logic unchanged)

- BR-P08: "DataIntegrityViolationException fallback" → "IntegrityError fallback (mapped by constraint name)"
- BR-P15: "`@TransactionalEventListener`" → "explicit broadcast after `await session.commit()`"
- BR-TM01: "`@Scheduled(fixedDelay=1000)`" → "FastAPI lifespan background task"
- BR-TM02: "`PESSIMISTIC_WRITE` lock" → "`SELECT … FOR UPDATE` (`with_for_update()`)"
- BR-SEC04: "BCryptPasswordEncoder" → "`bcrypt` package directly"
- BR-SEC05: "WebSocket CONNECT and SUBSCRIBE authenticated" → "cookie validated at WebSocket handshake; Origin checked"

### Section 7 (Unchanged Decisions) — updated

- Removed: references to `@Scheduled`, ArchUnit, Flyway, `java.time.Clock`, Lombok, "records for DTOs"
- Added: equivalent Python concepts (asyncio background task, import-linter, Alembic, Clock Protocol, Pydantic v2)

### Open Questions — all closed

OQ-1 through OQ-13 all carry `✅ Decided (default)` status with explicit answers.
