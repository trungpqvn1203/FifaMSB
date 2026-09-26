## 7. Unchanged Design Decisions

- Authentication & session cookie security (Section 6.0) with Python `bcrypt` directly
- Team management and `draftOrder`
- `DraftOrderStrategy` (Protocol) and `TimeoutPolicy` (Protocol)
- Timer logic background loop in FastAPI `lifespan`
- Pause/Resume/`remainingMillis` mechanics
- `Clock` Protocol injection everywhere (`FakeClock` in tests, no `sleep`)
- RFC 9457 ProblemDetail error format with `code` field
- Domain isolation: `domain` layer must not import `fastapi`, `api`, or `repository` modules
- Pydantic v2 models for request/response DTOs
- Layered architecture: `api.py → service.py → domain.py`; `repository.py → domain.py`

---

## 7.2 Required Tests (End-State Verification)

### Unit (no DB)
- pick on turn OK; wrong turn rejected (`NOT_YOUR_TURN`);
- one pick per turn: turn immediately advances to next team after pick;
- inactive player rejected (`PLAYER_NOT_AVAILABLE`);
- season not allowed rejected (`SEASON_NOT_ALLOWED`);
- already picked card rejected (`PLAYER_ALREADY_PICKED`);
- already picked player rejected when `uniqueBy=PLAYER` (`PLAYER_ALREADY_PICKED`);
- same player allowed when `uniqueBy=CARD`;
- budget exceeded rejected; roster full rejected (`rosterSize`);
- salary update (`PATCH` / re-import) rejected with `POOL_LOCKED` when draft is `PICKING` or `PAUSED`, accepted otherwise;
- salary validation: salary must be an integer >= 1;
- timeout -> `AutoPickCheapest` auto-picks 1 card and advances turn; `SkipTurn` skips turn and advances turn;
- draft completed after all rosters full or max rounds or no affordable card;
- cancel draft sets tournament back to `READY`; draft start resets teams `budget_used` to 0;
- pause/resume recomputes expiry;
- ban player not in target team roster rejected (`PLAYER_NOT_IN_ROSTER`);
- ban limit exceeded rejected (`BAN_LIMIT_REACHED`);
- ban on already confirmed team rejected (`BANS_ALREADY_CONFIRMED`);
- simultaneous ban hides opponent player identity until both confirm or timer expires;
- bans locked on confirmation or timeout.

### Integration (testcontainers PostgreSQL, real Alembic migrations)
- concurrent picks of the SAME PlayerSeason using `asyncio.gather`: exactly ONE succeeds;
- pick vs timeout race on the same draft;
- importer runs twice on fixture CSV -> no duplicates; auto-creates Season for unknown code;
- auth: `TEAM_USER` cannot act for another team or call admin endpoints;
- match ban concurrent submission and confirmation.
- Playwright: two browser contexts see realtime pick and ban updates.
- CI commands: `uv run ruff check .`, `uv run mypy --strict app`, `uv run lint-imports`, `uv run pytest`.

