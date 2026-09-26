## 1. Domain Analysis

### 1.1 Aggregate Boundaries

| Aggregate            | Root Entity    | Contained Entities        | Description                                           |
| -------------------- | -------------- | ------------------------- | ----------------------------------------------------- |
| **Tournament**       | `Tournament`   | `Team`                    | A tournament and its participating teams              |
| **Player Catalogue** | `Player`       | `PlayerSeason`            | Master player identity + season card stats            |
| **Season**           | `Season`       | —                         | Season card namespace (code, name, badge icon)        |
| **Draft**            | `DraftSession` | `DraftPick`, `DraftEvent` | Live draft session with multi-pick turns & versioning |
| **Match & Ban**      | `Match`        | `MatchBan`                | Matches and roster ban phase (replaces squad/lock)    |
| **Identity**         | `User`         | `Session`                 | Authentication & authorization                        |

### 1.2 Core Design Principle: Player vs PlayerSeason

```
Player          = WHO the footballer is (master identity, never duplicated)
Season          = WHICH season/class card (23UCL, ICON, CAP, BWC, 24EP, ...)
PlayerSeason    = HOW that card performs (salary, position, rating, stats)
```

**Anti-pattern to avoid:**

```
❌ Player #1 = "Son Heung-min — 23UCL"
❌ Player #2 = "Son Heung-min — ICON"
```

**Correct model:**

```
✅ Player      → Son Heung-min (one record, eternal)
   PlayerSeason → Son / 23UCL → rating 108, salary 26, position LW
   PlayerSeason → Son / CAP   → rating 105, salary 24, position LW
```

### 1.3 Entity Descriptions

#### Tournament

Represents a tournament configuration. Created by ADMIN. Tournaments draw from a multi-season pool defined in their rules (`allowedSeasonIds` in `rules` JSONB; empty list means all seasons). Default budget is 305. Default `rosterSize` is 24 (admin may set 23 or any 1..60).

**Key fields:** `id`, `name`, `status`, `rules` (JSONB validated by Pydantic `TournamentRules`), `createdAt`, `updatedAt`

**TournamentRules schema:**
- `rules_version`: INT (default 1)
- `rosterSize`: INT (range 1..60, default 24)
- `budget`: INT (default 305)
- `pickTimeSeconds`: INT (default 30)
- `uniqueBy`: `PLAYER` | `CARD` (default `PLAYER`)
- `timeoutPolicy`: `SKIP_TURN` | `AUTO_PICK_CHEAPEST` (default `AUTO_PICK_CHEAPEST`)
- `allowedSeasonIds`: `list[UUID]` (default `[]`, empty = all seasons allowed)
- `banCount`: INT (default 5)
- `banTimeSeconds`: INT (default 60)
- `banTarget`: `OPPONENT_ROSTER` | `OWN_ROSTER` (default `OPPONENT_ROSTER`)
- `banOrder`: `SIMULTANEOUS` | `ALTERNATING` (default `SIMULTANEOUS`)

**Status lifecycle:** `DRAFT` (< 2 teams) → `READY` (>= 2 teams registered, or when an active draft is cancelled) → `RUNNING` (when draft starts) → `COMPLETED` (set manually by ADMIN) | `CANCELLED`

> **Rule:** Draft rules are copied into `draft_sessions.rules_snapshot` at draft start and become immutable. Ban rules are snapshotted into `matches.rules_snapshot` when the match's ban phase starts.

#### Team

A participating team within a tournament. `draftOrder` determines when the team picks (1-based, 1..N). `budgetUsed` is updated atomically on each successful pick.
A team's roster is simply its `DraftPick` rows (retrieved via `GET /api/teams/{id}/roster`).

**Key fields:** `id`, `tournamentId`, `name`, `draftOrder` (1..N), `budgetUsed`, `status`

#### Season

Represents a card season/class in FC Online. Acts as a namespace for `PlayerSeason` cards imported from that class.

**Key fields:** `id`, `code` (e.g. `"23UCL"`, `"ICON"`), `name` (e.g. `"2023 UEFA Champions League"`), `badgeUrl` (nullable URL to season badge icon), `game` (e.g. `"FC Online"`), `year` (INT), `createdAt`

#### Player

Master identity record for a footballer. Shared across all seasons and tournaments. Contains only stable identity information.

**Key fields:** `id`, `name`, `externalPlayerId` (REQUIRED — unique external source ID used for matching and deduplication; rows missing it during import are skipped), `createdAt`

#### PlayerSeason

The card data for a player in a specific season class. This is what gets drafted.

**Key fields:** `id`, `playerId` _(FK → players.id)_, `seasonId` _(FK → seasons.id)_, `position`, `rating` (nullable INT), `salary` (INT >= 1, read directly from CSV or calibrated via `docs/tools/calibrate_salary.py`, updatable via PATCH / CSV re-import when pool is not locked), `imageUrl` (nullable), `status` (`ACTIVE|INACTIVE`), `pace`, `shooting`, `passing`, `dribbling`, `defending`, `physical` (all nullable)

**Positions:** Stores the game's original position string without collapsing (e.g. `ST, CF, LW, RW, CAM, CM, CDM, LM, RM, CB, LB, RB, LWB, RWB, GK`). No restrictive 13-value CHECK constraint. The UI groups them into filter chips (`FW`, `MF`, `DF`, `GK`).

#### DraftSession

The live draft session tied to a tournament. At most one active session per tournament at a time. Cancelled draft sessions remain in the database as audit history.

**Key fields:** `id`, `tournamentId`, `status` (`WAITING|PICKING|PAUSED|COMPLETED|CANCELLED`), `currentRound`, `currentTurn`, `currentTeamId`, `turnStartedAt`, `turnExpiresAt`, `remainingMillis`, `rulesSnapshot` (JSONB), `version` (INT NOT NULL, starts at 0, incremented under row lock on every state change), `createdAt`, `completedAt`

#### DraftPick

Immutable record of a single card pick event. Stores both `playerSeasonId` (the specific card) and `playerId` (the master identity), along with `uniqueByPlayer` (copied from rules).

**Key fields:** `id`, `draftSessionId`, `teamId`, `playerSeasonId` _(FK → player_seasons.id)_, `playerId` _(FK → players.id)_, `uniqueByPlayer` (BOOLEAN NOT NULL), `round`, `turnNumber`, `salaryAtPick`, `pickedAt`

#### DraftEvent

Append-only audit log of draft actions.

**Key fields:** `id`, `draftSessionId`, `type` (`START|PICK|SKIP|PAUSE|RESUME|COMPLETE|CANCEL`), `teamId`, `turnNumber`, `payload` (JSONB), `createdAt`

#### Match

Represents a scheduled match between two tournament teams. Manages the ban phase prior to gameplay (replaces squad lock).

**Key fields:** `id`, `tournamentId`, `homeTeamId`, `awayTeamId`, `status` (`SCHEDULED|BAN_PHASE|BANS_LOCKED|COMPLETED`), `scheduledAt` (nullable timestamptz), `rulesSnapshot` (JSONB), `banStartedAt` (nullable timestamptz), `banExpiresAt` (nullable timestamptz), `homeConfirmed` (BOOLEAN DEFAULT FALSE), `awayConfirmed` (BOOLEAN DEFAULT FALSE), `version` (INT NOT NULL DEFAULT 0), `createdAt`, `updatedAt`

#### MatchBan

A ban placed by one team on a player in the match.

**Key fields:** `id`, `matchId` _(FK → matches.id)_, `banningTeamId` _(FK → teams.id)_, `targetTeamId` _(FK → teams.id)_, `playerSeasonId` _(FK → player_seasons.id)_, `createdAt`

#### User & Session

System user and server-side login session (HttpOnly cookie with random token).

---

