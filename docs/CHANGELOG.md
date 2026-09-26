# Changelog

This document tracks changes to the FIFA / FC Online Player Draft System design and specifications.

## [Phase 3] — 2026-09-20 (Seasons, Player Catalogue & Importer Pipeline)

### Implemented Features
- **Player Positions (`app.player.position`)**:
  - Full support for original FC Online positions (`ST`, `CF`, `LW`, `RW`, `CAM`, `CM`, `CDM`, `LM`, `RM`, `CB`, `LB`, `RB`, `LWB`, `RWB`, `GK`).
  - Single-source position group mapping: `FW`, `MF`, `DF`, `GK`.
- **ETL Importer Pipeline (`app.importer`)**:
  - **Extract**: Streaming chunk processor using `pandas.read_csv(..., chunksize=...)`.
  - **Transform**: Pydantic validation (`ValidatedPlayerRow`) requiring `external_player_id`, integer `salary >= 1`, valid position string; invalid rows skipped and counted in report.
  - **Load**: Batch idempotent upserts using PostgreSQL `ON CONFLICT (external_player_id) DO UPDATE` for players and `ON CONFLICT (player_id, season_id) DO UPDATE` for player seasons. Auto-creates `Season` rows for unknown season codes.
  - **PoolLockPolicy**: Re-import and salary updates blocked with `POOL_LOCKED` (422) if draft is active.
  - **CLI & API**: Available via CLI (`python -m app.importer --file ...`) and multipart CSV endpoint `POST /api/admin/players/import`.
- **Player & Season API (`app.player.api`)**:
  - `GET /api/seasons`: List all seasons ordered by year, code.
  - `POST /api/seasons`: Admin create season with code, name, badge_url.
  - `GET /api/player-seasons`: Paginated cards with filter by `seasonId`, `position`, `group` (`FW|MF|DF|GK`), and unaccent trigram `search`.
  - `GET /api/player-seasons/{id}`: Detailed card view.
  - `PATCH /api/admin/player-seasons/{id}`: Admin update card salary (`>= 1`), guarded by pool lock.
- **Sample Dataset**:
  - Created `data/sample_players.csv` with 379 realistic player cards across seasons (`23UCL`, `ICON`, `CAP`, `LN`, `BWC`, `CC`, `VNM`, `24EP`), including Vietnamese players with diacritics (Quang Hải, Văn Hậu, Hoàng Đức, Tiến Linh,...).
- **Quality Gates**:
  - 100% type-checked with `mypy --strict app`.
  - All 4 `import-linter` contracts kept (pandas strictly restricted to `app.importer`).
  - Ruff formatting and lint clean.
  - 74 pytest unit & integration tests passing (including real PostgreSQL testcontainers).

## [Phase 0 Revision 4] — 2026-09-20 (FC Online Pro Draft & Matches/Bans Redesign)

### 1. Removal of Squad, Formation & Lock Module
- **Entities Removed**: Removed `Squad` and `SquadPlayer` tables and domain models.
- **Rules & Questions Dropped**: Removed rules `BR-S01..S05`, `OQ-3`, and the goalkeeper requirement `MUST_PICK_GOALKEEPER` as well as GK salary reservation in budget feasibility. Removed rule requiring `maxPlayersPerTeam >= 11`.
- **Endpoints Removed**: Removed `GET/PUT /api/teams/{id}/squad`, `POST /api/teams/{id}/squad/lock`, and `POST /api/teams/{id}/squad/unlock`.
- **Errors Removed**: Removed `SQUAD_LOCKED`, `SQUAD_INVALID`, `SQUAD_PLAYER_SEASON_MISMATCH`, and `MUST_PICK_GOALKEEPER`.
- **Roster Ownership**: A team's roster is now purely defined by its `DraftPick` records. Added `GET /api/teams/{id}/roster` to fetch a team's drafted cards.

### 2. Roster Size Refactoring
- **Field Renamed**: Renamed `maxPlayersPerTeam` to `rosterSize`.
- **Configurable Range**: Default `rosterSize = 24`, admin can set `23` or any value in `1..60`.
- **Draft Freedom**: No position or formation constraints exist during the draft process.

### 3. Tournament Rules Object (`TournamentRules` JSONB)
- **Flexible JSONB Configuration**: Tournaments store a `rules` JSONB column validated by Pydantic model `TournamentRules`, tracked with `rules_version`.
- **Rules Schema**:
  - `rosterSize`: int (1..60, default 24)
  - `budget`: int (default 305)
  - `pickTimeSeconds`: int (default 30)
  - `uniqueBy`: VARCHAR [`PLAYER` | `CARD`] (default `PLAYER`)
  - `timeoutPolicy`: VARCHAR [`SKIP_TURN` | `AUTO_PICK_CHEAPEST`] (default `AUTO_PICK_CHEAPEST`)
  - `allowedSeasonIds`: list[UUID] (empty = all seasons allowed)
  - `banCount`: int (default 5)
  - `banTimeSeconds`: int (default 60)
  - `banTarget`: VARCHAR [`OPPONENT_ROSTER` | `OWN_ROSTER`] (default `OPPONENT_ROSTER`)
  - `banOrder`: VARCHAR [`SIMULTANEOUS` | `ALTERNATING`] (default `SIMULTANEOUS`)
- **Rules Snapshots**: Draft rules are snapshotted into `draft_sessions.rules_snapshot` at draft start and remain immutable throughout the draft. Ban rules are snapshotted into `matches.rules_snapshot` when the match ban phase starts.

### 4. Multi-Season Pool Model
- **Removed Single-Season Binding**: Dropped `tournaments.season_id` FK column, `BR-T04`, and `PLAYER_SEASON_MISMATCH`. Tournaments draw cards from `allowedSeasonIds` (or all seasons if empty).
- **New Error**: Added `SEASON_NOT_ALLOWED` (422) if attempting to pick a card outside `allowedSeasonIds`.
- **Pool Validation**: Draft start requires at least `teams.count * rosterSize` ACTIVE `PlayerSeason` cards in the allowed seasons (`DRAFT_POOL_TOO_SMALL`, 422).
- **Season Enhancements**: Added `code` (VARCHAR NOT NULL UNIQUE, e.g. "23UCL", "ICON") and `badge_url` (VARCHAR nullable) to `Season`.

### 5. Card vs. Player Uniqueness
- **Dual Uniqueness Support**: `draft_picks` stores `player_id` (UUID) and `unique_by_player` (BOOLEAN).
- **Database Constraints**: Kept `UNIQUE(draft_session_id, player_season_id)` (card uniqueness) and added partial unique index `UNIQUE(draft_session_id, player_id) WHERE unique_by_player` (identity uniqueness). Both map cleanly to `PLAYER_ALREADY_PICKED` (409).
- **Card-Level Drafting**: When `uniqueBy = 'CARD'`, different teams can draft different season cards of the same footballer. When `uniqueBy = 'PLAYER'`, drafting any season card locks out that player entirely.

### 6. Turn Execution & Concurrency Token
- **One Pick Per Turn**: Dropped multi-pick turns (`picksPerTurn` and `pick_in_turn`). A single draft stage where each turn represents exactly one pick.
- **Turn Advancement**: Turn immediately advances to the next team via `DraftOrderStrategy` after a pick or upon timeout.
- **Constraint Retained**: Kept `UNIQUE(draft_session_id, turn_number)`.
- **Optimistic Concurrency**: Replaced `expectedTurn` with `expectedVersion` checking against `draft_sessions.version`.

### 7. Matches & Bans Module (Replacing Squad Lock)
- **New Entities**:
  - `matches`: `id`, `tournament_id`, `home_team_id`, `away_team_id`, `status` (`SCHEDULED`, `BAN_PHASE`, `BANS_LOCKED`, `COMPLETED`), `scheduled_at`, `rules_snapshot`, `ban_started_at`, `ban_expires_at`, `home_confirmed`, `away_confirmed`, `version`, `created_at`, `updated_at`.
  - `match_bans`: `id`, `match_id`, `banning_team_id`, `target_team_id`, `player_season_id`, `created_at` with constraint `UNIQUE(match_id, banning_team_id, player_season_id)`.
- **Ban Rules**:
  - Target player must belong to the target team's drafted roster (`PLAYER_NOT_IN_ROSTER`, 422).
  - Maximum `banCount` per team (`BAN_LIMIT_REACHED`, 422).
  - Simultaneous ban mode hides opponent/spectator ban identities (only count is exposed) until both teams confirm or the timer expires.
  - Confirmed teams cannot add/remove bans (`BANS_ALREADY_CONFIRMED`, 422). Once `BANS_LOCKED`, bans cannot be modified (`BANS_LOCKED`, 422).
- **Shared Infrastructure**: Uses `SELECT ... FOR UPDATE` on `matches` row lock, `Clock`, versioning, and WebSocket `/ws/matches/{id}`.
- **Endpoints Added**: `POST/GET /api/tournaments/{id}/matches`, `GET /api/matches/{id}`, `POST /api/matches/{id}/bans/start`, `POST /api/matches/{id}/bans`, `DELETE /api/matches/{id}/bans/{banId}`, `POST /api/matches/{id}/bans/confirm`, `POST /api/matches/{id}/complete`.
- **Tournament Completion**: ADMIN manually marks tournament complete (`POST /api/tournaments/{id}/complete`). No automatic fixture generation in v1.

### 8. Positions & Salary Management
- **Original Positions**: Store the original position strings from the game (ST, CF, LW, RW, CAM, CM, CDM, LM, RM, CB, LB, RB, LWB, RWB, GK). Removed collapsing and restrictive 13-position CHECK constraints.
- **UI Filter Chips**: UI groups positions into high-level filter chips (`FW`, `MF`, `DF`, `GK`).
- **Salary Data Handling & Updates**:
  - Salary is read directly from the CSV; `SalaryMapper` is retained only as an optional fallback when salary is omitted.
  - Added `PATCH /api/admin/player-seasons/{id}` (ADMIN, body `{salary: int >= 1}`) to manually update individual card salaries.
  - CSV re-import updates salaries via upsert.
  - **Pool Lock Protection (`POOL_LOCKED`, 422)**: Both CSV re-import and salary PATCH are rejected with `POOL_LOCKED` (422) while any draft session is in `PICKING` or `PAUSED` status.
  - `salary` must be an integer `>= 1`.
- **Offline Helper (`docs/tools/calibrate_salary.py`)**: Added standalone utility to generate synthetic salaries from ratings (tier or curve) for raw datasets lacking salary. Not part of the backend.

### 9. Importer CSV Format & Season Auto-Creation
- **CSV Schema**: `external_player_id, name, season_code, position, salary, rating, image_url` (`rating` and `image_url` optional).
- **Auto-Provisioning**: Encountering an unknown `season_code` during import automatically creates a corresponding `Season` record.

### 10. Draft Board Data & WebSocket Snapshot
- **Board Payload**: `GET /api/drafts/{id}/picks` and `/ws/drafts/{id}` snapshots provide: `round`, `turnNumber`, `team`, and `player { name, position, salary, season { id, code, badgeUrl } }`.
- **Draft Session Detail**: `GET /api/drafts/{id}` includes rules snapshot summary and team statistics (`budgetUsed`, `budgetRemaining`, `pickedCount`).
- **UI Reference**: Frontend draft board aligned with FC Online layout reference (`docs/ui/reference-draft-board.png`).

### 11. Architecture, Roadmap & Error Codes
- **Package Architecture**: Replaced `app/squad/` with `app/match/`.
- **Phase Roadmap**: Phase 8 updated from "Squad & Formation Lock" to "Matches & Bans".
- **Error Codes Updated**:
  - Removed: `SQUAD_LOCKED`, `SQUAD_INVALID`, `SQUAD_PLAYER_SEASON_MISMATCH`, `MUST_PICK_GOALKEEPER`, `PLAYER_SEASON_MISMATCH`.
  - Added: `SEASON_NOT_ALLOWED`, `MATCH_NOT_FOUND`, `MATCH_NOT_ACTIVE`, `PLAYER_NOT_IN_ROSTER`, `BAN_LIMIT_REACHED`, `BANS_ALREADY_CONFIRMED`, `BANS_LOCKED`, `POOL_LOCKED`.
- **Test Matrix Updated**: Updated unit, integration, and Playwright tests for single-pick turn advancement, player/card uniqueness, multi-season pool, match bans, salary validation/updates, and `POOL_LOCKED` protection.

---

---

_Revision 3, 2, 1 (2026-09-19) đã được chuyển sang [docs/changelog-archive.md](./changelog-archive.md)._
