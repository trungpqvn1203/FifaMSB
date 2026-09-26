## 6. API List with Request/Response Examples

> **Base URL:** `http://localhost:8080/api`
> **Auth:** Session cookie set on `POST /api/auth/login`
> **Error format:** RFC 9457 ProblemDetail with `code` field
> **OpenAPI spec:** Generated automatically by FastAPI. TypeScript types generated with `openapi-typescript` for the frontend.

---

### 6.0 Authentication & User Management

#### `POST /api/auth/login`

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "admin", "password": "secret" }
```

```json
// 200 OK — sets HttpOnly session cookie (token stored in `sessions` table)
{ "id": "usr-001", "username": "admin", "role": "ADMIN", "teamId": null }
```

#### `POST /api/auth/logout` → `204 No Content`

Deletes the session row from the `sessions` table and clears the cookie.

#### `GET /api/auth/me`

```json
// 200 OK
{
  "id": "usr-002",
  "username": "team_alpha",
  "role": "TEAM_USER",
  "teamId": "team-001"
}
```

#### `POST /api/admin/users` _(ADMIN)_

Creates a new user account with role `TEAM_USER` linked to a `teamId`.

```http
POST /api/admin/users
Content-Type: application/json

{
  "username": "team_alpha",
  "password": "password123",
  "teamId": "team-001"
}
```

```json
// 201 Created
{
  "id": "usr-002",
  "username": "team_alpha",
  "role": "TEAM_USER",
  "teamId": "team-001"
}
```

---

### 6.1 Seasons

#### `POST /api/seasons` _(ADMIN)_

```http
POST /api/seasons
Content-Type: application/json

{ "code": "23UCL", "name": "2023 UEFA Champions League", "badgeUrl": "/badges/23ucl.png", "game": "FC Online", "year": 2023 }
```

```json
// 201 Created
{
  "id": "season-001",
  "code": "23UCL",
  "name": "2023 UEFA Champions League",
  "badgeUrl": "/badges/23ucl.png",
  "game": "FC Online",
  "year": 2023,
  "createdAt": "2026-09-20T00:00:00Z"
}
```

#### `GET /api/seasons`

```json
// 200 OK
[
  { "id": "season-001", "code": "23UCL", "name": "2023 UEFA Champions League", "badgeUrl": "/badges/23ucl.png", "game": "FC Online", "year": 2023 },
  { "id": "season-002", "code": "ICON", "name": "Icon Class", "badgeUrl": "/badges/icon.png", "game": "FC Online", "year": 2024 }
]
```

---

### 6.2 Player Import _(ADMIN — multipart CSV)_

#### `POST /api/admin/players/import` _(ADMIN)_

Imports player card data from a CSV file. Synchronous — returns import report. Idempotent. `externalPlayerId` is REQUIRED on every row; rows lacking it are skipped and reported. If a `season_code` does not exist in `seasons`, it automatically inserts a new `Season` record. Re-import updates player metadata and salaries.

> **Guard:** If any draft session in the system has status `PICKING` or `PAUSED`, this request is rejected with `POOL_LOCKED` (422).

**CSV format:** `external_player_id, name, season_code, position, salary, rating, image_url`

```http
POST /api/admin/players/import
Content-Type: multipart/form-data

file=<CSV file>
```

```json
// 200 OK
{
  "rowsRead": 500,
  "inserted": 480,
  "updated": 15,
  "skipped": 5,
  "newSeasonsCreated": ["23UCL"],
  "errors": [{ "row": 42, "reason": "Missing externalPlayerId" }]
}
```

> **CLI equivalent:** `uv run python -m app.importer --file players.csv`

---

### 6.3 Player Seasons

#### `GET /api/player-seasons?allowedSeasonIds=season-001&position=LW&search=son&page=0`

Returns paginated `PlayerSeason` records.

**Query parameters:**
- `allowedSeasonIds`: optional comma-separated season UUIDs to filter allowed seasons.
- `position`: optional position filter (`FW`, `MF`, `DF`, `GK` group or specific position like `ST`, `LWB`, etc.).
- `search`: optional player name search. Uses PostgreSQL `pg_trgm` + `unaccent` via a GIN index on `immutable_unaccent(name)`. Case-insensitive, accent-insensitive.
- `page`: 0-indexed page number (default 0).
- `size`: page size (default 20).

```json
// 200 OK
{
  "content": [
    {
      "playerSeasonId": "ps-007",
      "playerId": "player-007",
      "name": "Son Heung-min",
      "position": "LW",
      "rating": 108,
      "salary": 26,
      "imageUrl": null,
      "status": "ACTIVE",
      "season": {
        "id": "season-001",
        "code": "23UCL",
        "name": "2023 UEFA Champions League",
        "badgeUrl": "/badges/23ucl.png"
      }
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

#### `GET /api/player-seasons/{id}`

```json
// 200 OK — single PlayerSeason card with season info
```

#### `PATCH /api/admin/player-seasons/{id}` _(ADMIN)_

Updates the salary of an individual `PlayerSeason`.

**Validations:**
- `salary` must be an integer `>= 1` (otherwise returns 422).
- If any draft session is `PICKING` or `PAUSED`, returns `POOL_LOCKED` (422).
- If `PlayerSeason` does not exist, returns `PLAYER_NOT_FOUND` (404).

```http
PATCH /api/admin/player-seasons/ps-007
Content-Type: application/json

{
  "salary": 28
}
```

```json
// 200 OK
{
  "playerSeasonId": "ps-007",
  "playerId": "player-007",
  "name": "Son Heung-min",
  "position": "LW",
  "rating": 108,
  "salary": 28,
  "imageUrl": null,
  "status": "ACTIVE",
  "season": {
    "id": "season-001",
    "code": "23UCL",
    "name": "2023 UEFA Champions League",
    "badgeUrl": "/badges/23ucl.png"
  }
}
```

---

### 6.4 Tournaments

#### `POST /api/tournaments` _(ADMIN)_

Creates a tournament with a configurable `rules` JSONB object.

```http
POST /api/tournaments
Content-Type: application/json

{
  "name": "Vietnam FC Online Championship 2026",
  "rules": {
    "rules_version": 1,
    "rosterSize": 24,
    "budget": 305,
    "pickTimeSeconds": 30,
    "uniqueBy": "PLAYER",
    "timeoutPolicy": "AUTO_PICK_CHEAPEST",
    "allowedSeasonIds": [],
    "banCount": 5,
    "banTimeSeconds": 60,
    "banTarget": "OPPONENT_ROSTER",
    "banOrder": "SIMULTANEOUS"
  }
}
```

```json
// 201 Created
{
  "id": "trn-001",
  "name": "Vietnam FC Online Championship 2026",
  "status": "DRAFT",
  "rules": {
    "rules_version": 1,
    "rosterSize": 24,
    "budget": 305,
    "pickTimeSeconds": 30,
    "uniqueBy": "PLAYER",
    "timeoutPolicy": "AUTO_PICK_CHEAPEST",
    "allowedSeasonIds": [],
    "banCount": 5,
    "banTimeSeconds": 60,
    "banTarget": "OPPONENT_ROSTER",
    "banOrder": "SIMULTANEOUS"
  },
  "createdAt": "2026-09-20T00:00:00Z",
  "updatedAt": "2026-09-20T00:00:00Z"
}
```

#### `GET /api/tournaments`

```json
// 200 OK — list of tournaments
```

#### `GET /api/tournaments/{id}`

Returns tournament details including `draftId` (nullable), rules, and teams array.

```json
// 200 OK
{
  "id": "trn-001",
  "name": "Vietnam FC Online Championship 2026",
  "status": "RUNNING",
  "draftId": "draft-001",
  "rules": {
    "rosterSize": 24,
    "budget": 305,
    "pickTimeSeconds": 30,
    "uniqueBy": "PLAYER",
    "timeoutPolicy": "AUTO_PICK_CHEAPEST",
    "allowedSeasonIds": [],
    "banCount": 5,
    "banTimeSeconds": 60,
    "banTarget": "OPPONENT_ROSTER",
    "banOrder": "SIMULTANEOUS"
  },
  "teams": [
    {
      "id": "team-001",
      "name": "Flash FC",
      "draftOrder": 1,
      "budgetUsed": 50,
      "budgetRemaining": 255,
      "pickedCount": 2,
      "status": "ACTIVE"
    }
  ]
}
```

#### `POST /api/tournaments/{id}/complete` _(ADMIN)_

Manually transitions a tournament to `COMPLETED` when matches and tournament operations conclude.

```json
// 200 OK
{ "id": "trn-001", "status": "COMPLETED" }
```

---

### 6.5 Teams & Roster

#### `POST /api/tournaments/{id}/teams` _(ADMIN)_

```http
POST /api/tournaments/trn-001/teams
Content-Type: application/json

{ "name": "Flash FC", "draftOrder": 1 }
```

#### `GET /api/tournaments/{id}/teams`

```json
// 200 OK — list of teams with draftOrder, budgetUsed, budgetRemaining
```

#### `GET /api/teams/{id}/roster`

Returns the list of player cards drafted by this team (its `DraftPick` rows).

```json
// 200 OK
{
  "teamId": "team-001",
  "teamName": "Flash FC",
  "rosterCount": 2,
  "budgetUsed": 50,
  "budgetRemaining": 255,
  "roster": [
    {
      "pickId": "pick-001",
      "round": 1,
      "turnNumber": 1,
      "salaryAtPick": 26,
      "pickedAt": "2026-09-20T01:00:15Z",
      "player": {
        "playerSeasonId": "ps-007",
        "playerId": "player-007",
        "name": "Son Heung-min",
        "position": "LW",
        "rating": 108,
        "salary": 26,
        "season": {
          "id": "season-001",
          "code": "23UCL",
          "badgeUrl": "/badges/23ucl.png"
        }
      }
    }
  ]
}
```

---

### 6.6 Draft

#### `POST /api/tournaments/{id}/draft/start` _(ADMIN)_

Requires tournament status `READY` (at least 2 teams registered, and pool having `>= teams.count * rules.rosterSize` ACTIVE cards in allowed seasons; otherwise returns `DRAFT_POOL_TOO_SMALL` 422). Resets `teams.budget_used = 0` for all teams in tournament, snapshots rules into `rules_snapshot`, creates `DraftSession` with `status = PICKING` and `version = 1`.

```http
POST /api/tournaments/trn-001/draft/start
```

```json
// 201 Created
{
  "id": "draft-001",
  "tournamentId": "trn-001",
  "status": "PICKING",
  "currentRound": 1,
  "currentTurn": 1,
  "currentTeamId": "team-001",
  "turnStartedAt": "2026-09-20T01:00:00Z",
  "turnExpiresAt": "2026-09-20T01:00:30Z",
  "rulesSnapshot": {
    "rosterSize": 24,
    "budget": 305,
    "pickTimeSeconds": 30,
    "uniqueBy": "PLAYER",
    "timeoutPolicy": "AUTO_PICK_CHEAPEST"
  },
  "version": 1
}
```

#### `GET /api/drafts/{id}`

```json
// 200 OK
{
  "id": "draft-001",
  "tournamentId": "trn-001",
  "status": "PICKING",
  "currentRound": 1,
  "currentTurn": 1,
  "currentTeamId": "team-001",
  "turnStartedAt": "2026-09-20T01:00:00Z",
  "turnExpiresAt": "2026-09-20T01:00:30Z",
  "remainingMillis": null,
  "version": 1,
  "serverTime": "2026-09-20T01:00:10Z",
  "rulesSnapshot": {
    "rosterSize": 24,
    "budget": 305,
    "pickTimeSeconds": 30,
    "uniqueBy": "PLAYER"
  },
  "teams": [
    {
      "id": "team-001",
      "name": "Flash FC",
      "draftOrder": 1,
      "budgetUsed": 0,
      "budgetRemaining": 305,
      "pickedCount": 0
    }
  ]
}
```

#### `GET /api/drafts/{id}/picks`

Returns list of all picks formatted for the draft board (matching layout in `docs/ui/reference-draft-board.png`).

```json
// 200 OK
[
  {
    "id": "pick-001",
    "round": 1,
    "turnNumber": 1,
    "salaryAtPick": 26,
    "pickedAt": "2026-09-20T01:00:15Z",
    "team": {
      "id": "team-001",
      "name": "Flash FC",
      "draftOrder": 1
    },
    "player": {
      "playerSeasonId": "ps-007",
      "playerId": "player-007",
      "name": "Son Heung-min",
      "position": "LW",
      "rating": 108,
      "salary": 26,
      "season": {
        "id": "season-001",
        "code": "23UCL",
        "badgeUrl": "/badges/23ucl.png"
      }
    }
  }
]
```

#### `POST /api/drafts/{id}/picks` _(TEAM_USER)_

```http
POST /api/drafts/draft-001/picks
Content-Type: application/json

{
  "playerSeasonId": "ps-007",
  "expectedVersion": 1
}
```

```json
// 201 Created
{
  "pick": {
    "id": "pick-001",
    "round": 1,
    "turnNumber": 1,
    "teamId": "team-001",
    "playerSeasonId": "ps-007",
    "playerId": "player-007",
    "salaryAtPick": 26,
    "pickedAt": "2026-09-20T01:00:15Z"
  },
  "nextState": {
    "currentRound": 1,
    "currentTurn": 2,
    "currentTeamId": "team-002",
    "turnExpiresAt": "2026-09-20T01:00:45Z",
    "version": 2
  }
}
```

```json
// 422 — SEASON_NOT_ALLOWED
{
  "type": "https://fifadraft.example.com/errors/season-not-allowed",
  "title": "Season Not Allowed",
  "status": 422,
  "code": "SEASON_NOT_ALLOWED",
  "message": "Player card belongs to season 'FIFA 23', which is not in the allowed season pool."
}
```

```json
// 409 — PLAYER_ALREADY_PICKED
{
  "type": "https://fifadraft.example.com/errors/player-already-picked",
  "title": "Player Already Picked",
  "status": 409,
  "code": "PLAYER_ALREADY_PICKED",
  "message": "Player 'Son Heung-min' has already been drafted."
}
```

```json
// 422 — TURN_EXPIRED
{
  "type": "https://fifadraft.example.com/errors/turn-expired",
  "title": "Turn Expired",
  "status": 422,
  "code": "TURN_EXPIRED",
  "message": "Turn 1 expired before your pick was processed. Timeout auto-pick applied."
}
```

#### `POST /api/drafts/{id}/pause` _(ADMIN)_
#### `POST /api/drafts/{id}/resume` _(ADMIN)_
#### `POST /api/drafts/{id}/cancel` _(ADMIN — returns tournament status to READY)_

---

### 6.7 Matches & Bans (replaces Squad)

#### `POST /api/tournaments/{id}/matches` _(ADMIN)_

Creates a scheduled match between two tournament teams.

```http
POST /api/tournaments/trn-001/matches
Content-Type: application/json

{
  "homeTeamId": "team-001",
  "awayTeamId": "team-002",
  "scheduledAt": "2026-09-20T14:00:00Z"
}
```

```json
// 201 Created
{
  "id": "match-001",
  "tournamentId": "trn-001",
  "homeTeam": { "id": "team-001", "name": "Flash FC" },
  "awayTeam": { "id": "team-002", "name": "Saigon FC" },
  "status": "SCHEDULED",
  "scheduledAt": "2026-09-20T14:00:00Z",
  "version": 0
}
```

#### `GET /api/tournaments/{id}/matches`
#### `GET /api/matches/{id}`

Returns match details. In `SIMULTANEOUS` ban mode, if status is `BAN_PHASE`, the opposing team's ban identity is hidden (only the count `opponentBanCount` is returned) until `BANS_LOCKED`.

```json
// 200 OK (viewed by Flash FC during BAN_PHASE)
{
  "id": "match-001",
  "status": "BAN_PHASE",
  "homeTeam": { "id": "team-001", "name": "Flash FC", "confirmed": false, "banCount": 2 },
  "awayTeam": { "id": "team-002", "name": "Saigon FC", "confirmed": false, "banCount": 3 },
  "banStartedAt": "2026-09-20T13:50:00Z",
  "banExpiresAt": "2026-09-20T13:51:00Z",
  "version": 4,
  "myBans": [
    {
      "id": "ban-001",
      "playerSeasonId": "ps-010",
      "playerName": "Ronaldo Nazário",
      "position": "ST",
      "targetTeamId": "team-002"
    }
  ]
}
```

#### `POST /api/matches/{id}/bans/start` _(ADMIN)_

Starts the ban phase for this match. Snapshots the tournament ban rules, sets `banStartedAt` and `banExpiresAt`, status transitions to `BAN_PHASE`.

#### `POST /api/matches/{id}/bans` _(TEAM_USER — banning team)_

Submits a roster ban. Target player must belong to target team's drafted roster. Max `banCount` per team.

```http
POST /api/matches/match-001/bans
Content-Type: application/json

{
  "playerSeasonId": "ps-010",
  "targetTeamId": "team-002"
}
```

#### `DELETE /api/matches/{id}/bans/{banId}` _(TEAM_USER — remove pending ban before confirm)_

#### `POST /api/matches/{id}/bans/confirm` _(TEAM_USER — confirm bans)_

Confirms the team's bans. When both teams confirm, or when timer expires, match transitions to `BANS_LOCKED` and all bans are revealed.

#### `POST /api/matches/{id}/complete` _(ADMIN — mark match COMPLETED)_

---

### 6.8 WebSockets (plain — no STOMP)

#### Draft WebSocket: `ws://localhost:8080/ws/drafts/{draft_id}`

Transmits full `DraftState` snapshot matching FC Online draft board:

```json
{
  "draftId": "draft-001",
  "version": 8,
  "serverTime": "2026-09-20T01:05:00Z",
  "status": "PICKING",
  "currentRound": 1,
  "currentTurn": 2,
  "currentTeamId": "team-002",
  "turnStartedAt": "2026-09-20T01:04:45Z",
  "turnExpiresAt": "2026-09-20T01:05:15Z",
  "pickedPlayer": {
    "playerSeasonId": "ps-007",
    "playerId": "player-007",
    "name": "Son Heung-min",
    "position": "LW",
    "rating": 108,
    "salary": 26,
    "season": {
      "id": "season-001",
      "code": "23UCL",
      "badgeUrl": "/badges/23ucl.png"
    }
  },
  "teams": [
    {
      "id": "team-001",
      "name": "Flash FC",
      "draftOrder": 1,
      "budgetUsed": 26,
      "budgetRemaining": 279,
      "pickedCount": 1
    }
  ]
}
```

#### Match Ban WebSocket: `ws://localhost:8080/ws/matches/{match_id}`

Transmits real-time ban phase countdown, confirmation state, and ban updates.

---

