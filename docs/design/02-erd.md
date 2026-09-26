## 2. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    SEASONS {
        uuid id PK
        varchar code UK
        varchar name
        varchar badge_url
        varchar game
        int year
        timestamptz created_at
    }

    PLAYERS {
        uuid id PK
        varchar name
        varchar external_player_id UK
        timestamptz created_at
    }

    PLAYER_SEASONS {
        uuid id PK
        uuid player_id FK
        uuid season_id FK
        varchar position
        int rating
        int salary
        varchar image_url
        varchar status
        int pace
        int shooting
        int passing
        int dribbling
        int defending
        int physical
    }

    TOURNAMENTS {
        uuid id PK
        varchar name
        varchar status
        jsonb rules
        timestamptz created_at
        timestamptz updated_at
    }

    TEAMS {
        uuid id PK
        uuid tournament_id FK
        varchar name
        int draft_order
        int budget_used
        varchar status
    }

    DRAFT_SESSIONS {
        uuid id PK
        uuid tournament_id FK
        varchar status
        int current_round
        int current_turn
        uuid current_team_id FK
        timestamptz turn_started_at
        timestamptz turn_expires_at
        bigint remaining_millis
        jsonb rules_snapshot
        int version
        timestamptz created_at
        timestamptz completed_at
    }

    DRAFT_PICKS {
        uuid id PK
        uuid draft_session_id FK
        uuid team_id FK
        uuid player_season_id FK
        uuid player_id FK
        boolean unique_by_player
        int round
        int turn_number
        int salary_at_pick
        timestamptz picked_at
    }

    DRAFT_EVENTS {
        uuid id PK
        uuid draft_session_id FK
        varchar type
        uuid team_id
        int turn_number
        jsonb payload
        timestamptz created_at
    }

    MATCHES {
        uuid id PK
        uuid tournament_id FK
        uuid home_team_id FK
        uuid away_team_id FK
        varchar status
        timestamptz scheduled_at
        jsonb rules_snapshot
        timestamptz ban_started_at
        timestamptz ban_expires_at
        boolean home_confirmed
        boolean away_confirmed
        int version
        timestamptz created_at
        timestamptz updated_at
    }

    MATCH_BANS {
        uuid id PK
        uuid match_id FK
        uuid banning_team_id FK
        uuid target_team_id FK
        uuid player_season_id FK
        timestamptz created_at
    }

    USERS {
        uuid id PK
        varchar username UK
        varchar password_hash
        varchar role
        uuid team_id FK
    }

    SESSIONS {
        varchar id PK
        uuid user_id FK
        timestamptz expires_at
        timestamptz created_at
    }

    SEASONS ||--o{ PLAYER_SEASONS : "has"
    PLAYERS ||--o{ PLAYER_SEASONS : "has versions"
    PLAYERS ||--o{ DRAFT_PICKS : "referenced by"
    PLAYER_SEASONS ||--o{ DRAFT_PICKS : "picked as"
    PLAYER_SEASONS ||--o{ MATCH_BANS : "banned as"
    TOURNAMENTS ||--o{ TEAMS : "has"
    TOURNAMENTS ||--o| DRAFT_SESSIONS : "has at most one active"
    TOURNAMENTS ||--o{ MATCHES : "has"
    TEAMS ||--o{ DRAFT_PICKS : "makes"
    TEAMS ||--o{ MATCHES : "home/away"
    TEAMS ||--o{ MATCH_BANS : "bans/targeted"
    TEAMS ||--o{ USERS : "assigned to"
    DRAFT_SESSIONS ||--o{ DRAFT_PICKS : "contains"
    DRAFT_SESSIONS ||--o{ DRAFT_EVENTS : "logs"
    MATCHES ||--o{ MATCH_BANS : "contains"
    USERS ||--o{ SESSIONS : "has"
```

### Key Database Constraints

| Table            | Constraint                                                                   | Purpose                                                        |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `seasons`        | `UNIQUE(code)`                                                               | Unique season identifier code (e.g. 23UCL, ICON)               |
| `player_seasons` | `UNIQUE(player_id, season_id)`                                               | One entry per player per season card                           |
| `player_seasons` | `CHECK(salary >= 1)`                                                         | Salary must be a positive integer >= 1                         |
| `players`        | `UNIQUE(external_player_id)`                                                 | Deduplication strictly by external source ID (required)        |
| `players`        | `GIN(immutable_unaccent(name) gin_trgm_ops)`                                  | Fast trigram player name search (`GET /api/player-seasons?search=`) with unaccent wrapper |
| `draft_picks`    | `UNIQUE(draft_session_id, player_season_id)`                                 | Exact card version can never be picked twice in same draft     |
| `draft_picks`    | `UNIQUE(draft_session_id, player_id) WHERE unique_by_player`                 | Partial unique index: no duplicate player identity when `uniqueBy=PLAYER` |
| `draft_picks`    | `UNIQUE(draft_session_id, turn_number)`                                      | Exactly one pick per turn in draft session                     |
| `teams`          | `UNIQUE(tournament_id, draft_order)`                                         | Unique pick order within tournament                            |
| `teams`          | `CHECK(budget_used >= 0)`                                                    | Budget never goes negative                                     |
| `draft_sessions` | `version INT NOT NULL DEFAULT 0`                                             | Monotonically increasing draft state version counter           |
| `draft_sessions` | `UNIQUE(tournament_id) WHERE status IN ('WAITING','PICKING','PAUSED')`       | At most one active draft per tournament (partial unique index) |
| `matches`        | `version INT NOT NULL DEFAULT 0`                                             | Concurrency version counter for match & ban phase              |
| `match_bans`     | `UNIQUE(match_id, banning_team_id, player_season_id)`                        | Team cannot ban the same player card twice in a match          |

> **Database rules (Python/Alembic):**
>
> - Migrations via **Alembic only**. `Base.metadata.create_all()` is forbidden in application code. Tests run real Alembic migrations via testcontainers.
> - Autogenerated migrations are a starting point only — review by hand. Write partial indexes, CHECK constraints and server defaults explicitly.
> - Set a SQLAlchemy `naming_convention` on `MetaData` so constraint/index names are stable. Required because `IntegrityError` handling maps constraint names to domain errors.
> - Enums: `VARCHAR + CHECK constraint` (no PostgreSQL enum types). Timestamps: `timestamptz` (`DateTime(timezone=True)`), always timezone-aware UTC in Python. Salary/budget: `INT`.
> - GIN index with `pg_trgm + unaccent` on `players.name` for player name search (`GET /api/player-seasons?search=`). PostgreSQL `unaccent` is not `IMMUTABLE`: the Alembic migration must define an immutable wrapper function (e.g. `immutable_unaccent(text)`) and index on it. The importer still must NOT use fuzzy matching (deduplication strictly by `externalPlayerId`).

---

