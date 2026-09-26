# ROADMAP — FIFA/FC Online Player Draft

Source of truth for PHASE ORDER. Domain and API details live in `design.md`; stack and
coding rules live in `AGENTS.md`. If they conflict, STOP and ask.

## Working rules

- Do ONE phase at a time. When it is done: run `uv run ruff check .`, `uv run mypy --strict app`,
  `uv run lint-imports`, `uv run pytest`; summarize; add a "Python concepts used" section;
  list deviations; then STOP and wait for my confirmation.
- Each phase adds its OWN Alembic migration. Never create tables for a later phase early.
- Dev database: Docker Compose PostgreSQL. Tests: testcontainers PostgreSQL (never SQLite).
- UI phases must read `docs/ui/tokens.md` first and use the matching Stitch HTML
  (`docs/ui/*.html`) as the visual reference. Do not paste HTML into chat; read it from disk once.
- Until the admin UI exists (Phase 11), admin tasks are done through Swagger (`/docs`).

## Phase 0.5 — UI preparation (no application code)

- Stitch HTML saved in `docs/ui/` (draft-board.html, admin-tournament.html, match-bans.html)
  with screenshots. Inline base64 images and long inline SVG removed.
- `docs/ui/tokens.md`: colors, fonts, spacing, radii, component list.
- `docs/ui/api-gaps.md`: for each screen, the data fields it needs, compared with the API in
  `design.md`; list every mismatch. Update `design.md` for accepted gaps.
- Acceptance: gap list reviewed and resolved.

## Phase 1 — Scaffold, base infrastructure, first migration

- uv project, `pyproject.toml` (ruff, mypy strict, pytest, pytest-asyncio, import-linter),
  package-by-feature skeleton from AGENTS.md.
- `config.py`, `db.py` (async engine), `Clock` / `SystemClock` / `FakeClock`, `DomainError` +
  RFC 9457 handlers, request-id logging, `GET /health`.
- `docker-compose.dev.yml` with PostgreSQL 16 only, `.env.example`.
- Alembic + SQLAlchemy naming convention.
- Migration 0001: extensions `pg_trgm`, `unaccent`, immutable unaccent wrapper function, and
  tables `seasons`, `players`, `player_seasons`, `users`, `sessions`, `tournaments` (rules JSONB),
  `teams`, with all constraints and the name-search index.
- Acceptance: the four CI commands pass; migration upgrade + downgrade works on a real
  PostgreSQL container; `/health` returns 200.

## Phase 2 — Authentication and RBAC

- bcrypt, `sessions` table, HttpOnly cookie (SameSite=Lax), expiry.
- Dependencies `get_current_user`, `require_admin`, `get_current_team`.
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/admin/users`.
- CLI to create the first admin: `uv run python -m app.auth.create_admin`.
- Acceptance: TEAM_USER cannot call admin endpoints; cookie flags verified; expired session rejected.

## Phase 3 — Seasons, player catalogue, importer (ETL)

- `app/importer/`: extract (chunked CSV), transform (keep original position, require
  `external_player_id`, read salary from CSV, optional fallback), load (batch upsert, idempotent),
  import report. Unknown `season_code` creates a Season.
- API: seasons, `GET /api/player-seasons` (pagination; filter by season, exact position or
  position group GK/DF/MF/FW mapped in ONE place; unaccent trigram search),
  `POST /api/admin/players/import`, `PATCH /api/admin/player-seasons/{id}`, CLI import.
- `POOL_LOCKED` is implemented through a `PoolLockPolicy` protocol that returns "not locked"
  until Phase 5 wires the real check (draft tables do not exist yet).
- Dev data: `data/sample_players.csv` (about 300 rows) and `docs/tools/calibrate_salary.py`.
- Acceptance: re-import creates no duplicates; Vietnamese/accent-insensitive search works;
  rows without `external_player_id` are skipped and reported.

## Phase 4 — Tournaments, rules, teams

- Pydantic `TournamentRules` validating `tournaments.rules` (defaults per design.md).
- Status lifecycle DRAFT -> READY (>= 2 teams). `POST /api/tournaments/{id}/complete` (ADMIN).
- `POST/GET /api/tournaments`, `GET /api/tournaments/{id}`, `POST/GET /api/tournaments/{id}/teams`,
  `GET /api/teams/{id}/roster`.
- Acceptance: invalid rules rejected with a clear error; `UNIQUE(tournament_id, draft_order)` enforced.

## Phase 5 — Draft engine (backend only) [use Plan mode]

- Migration 0002: `draft_sessions`, `draft_picks`, `draft_events` with all constraints.
- Start / pick / pause / resume / cancel per design.md (single transaction, `FOR UPDATE`,
  `expectedVersion`, budget and feasibility, uniqueness by PLAYER or CARD, version increments).
- Pure domain: `DraftOrderStrategy` (Linear), `TimeoutPolicy` (AutoPickCheapest default, SkipTurn)
  and `apply_timeout()` used by BR-P04. The background loop comes in Phase 6, but the timeout
  logic itself belongs HERE.
- `DraftBroadcaster` protocol with a no-op implementation, called only after commit.
- Wire the real `PoolLockPolicy` (POOL_LOCKED while a draft is PICKING or PAUSED).
- Acceptance: unit tests for rotation, budget, feasibility, uniqueness, completion; integration
  test where concurrent picks of the same card give exactly one success; pick-vs-timeout race test.

## Phase 5.5 — Simulation script (small, optional)

- `scripts/simulate_draft.py`: logs in as N team users over HTTP and runs a full draft,
  including simultaneous picks and one expired turn, against a running server.
- Acceptance: a 4-team draft completes; total salary per team never exceeds the budget.

## Phase 6 — Timer loop and WebSocket

- Lifespan background loop (about 1 s) calls `apply_timeout()` in its own transaction per draft.
- `/ws/drafts/{draft_id}`: cookie auth at handshake, Origin check, only users of that
  tournament; full snapshot JSON with `version` and `serverTime`; heartbeat; real
  `DraftBroadcaster`. Document that the app runs with ONE Uvicorn worker.
- Acceptance: auto-pick after expiry (FakeClock, no sleeps); two clients receive increasing
  versions; unauthorized user rejected; event loop is never blocked.

## Phase 7 — Frontend foundation

- Vite + React + TS + Tailwind + shadcn/ui; theme from `docs/ui/tokens.md`.
- `openapi-typescript` generated types, axios client, TanStack Query.
- Login page, app shell, tournament list/detail, role-aware routes.
- Acceptance: login via cookie works through the Vite proxy; generated types compile.

## Phase 8 — Draft board UI

- Implement from `docs/ui/draft-board.html`. Team columns, round rows, budget bars, big
  countdown, highlighted current cell, player pool with position filter chips and search,
  PICK button (UX only; backend validates everything).
- `useDraftSocket`: native WebSocket, reconnect with backoff, refetch when version skips,
  countdown from `turnExpiresAt` with `serverTime` offset.
- Acceptance: two browsers (two users) see each other's picks within about 1 second without
  reload; a lost connection resyncs after reconnect.

## Phase 9 — Matches and bans (backend)

- Migration 0003: `matches`, `match_bans`.
- Endpoints per design.md; SIMULTANEOUS mode hides the opponent's ban identities until both
  confirm or the timer expires; the same timer loop locks expired ban phases; `/ws/matches/{id}`.
- Acceptance: cannot ban a player outside the target roster; ban secrecy test; auto-lock on timer.

## Phase 10 — Ban UI

- Implement from `docs/ui/match-bans.html` with a match WebSocket hook.
- Acceptance: two browsers ban in parallel, opponent's picks stay hidden until lock.

## Phase 11 — Admin UI

- Implement from `docs/ui/admin-tournament.html`: tournament + rules form, teams and user
  accounts, CSV import with report, draft controls (start/pause/resume/cancel), matches list,
  start ban phase, complete tournament.
- Acceptance: a whole tournament can be run without Swagger.

## Phase 12 — E2E, Docker, hardening

- Playwright with two browser contexts (draft + bans).
- Dockerfiles (multi-stage), `docker-compose.yml` (postgres, backend, nginx), Nginx `/api` and
  `/ws` proxy with Upgrade headers and long read timeout, `.env.example`.
- README: run, first admin, import data, backup, HTTPS note, one-worker note.
- Acceptance: `docker compose up --build` works end to end; all CI checks pass.

## Allowed merges (only if the phase turns out small)

Phase 9 + 10, Phase 7 + 8. Never merge Phase 5 with anything.
