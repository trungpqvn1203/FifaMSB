# PROJECT: FIFA / FC Online Player Draft System (Python backend)

Build a realtime multi-team player draft system for a Vietnamese FC Online pro tournament.
Work in PHASES. After finishing each phase: run lint, type-check and tests, summarize what
you did, list any deviations, then STOP and wait for my confirmation.
Do not start the next phase on your own. Do not over-engineer.

## SOURCE OF TRUTH & NAVIGATION

- `AGENTS.md` (this file): Source of truth for stack, architecture, coding constraints, and workflow.
- `CONTEXT.md`: Current project status, completed phases, active DB schema & test counts. Read this first in each session.
- `docs/design.md`: Index pointing to detailed domain specifications in `docs/design/01-08*.md`:
  - Domain Model & Entities: `docs/design/01-domain-analysis.md`
  - Database Schema & ERD: `docs/design/02-erd.md`
  - Draft State Machine & Timer: `docs/design/03-draft-state-machine.md`
  - Import ETL Pipeline: `docs/design/04-import-architecture.md`
  - Business Rules & Pick Logic (BR-P01..BR-P15): `docs/design/05-business-rules.md`
  - API Specifications: `docs/design/06-api-spec.md`
  - Decisions & Required Test Suite: `docs/design/07-decisions.md`
- `.agents/rules/coding-standards.md`: Detailed coding guidelines, Alembic rules & import-linter contracts.
- `.agents/rules/quick-ref.md`: Quick reference tables for entities, error codes, and endpoints.
- If documents conflict, STOP and ask me. Do not silently pick one.

## SESSION START PROTOCOL (token-efficient — đọc theo thứ tự này)

> **MANDATORY**: Đọc đúng thứ tự dưới đây khi bắt đầu session mới. KHÔNG load toàn bộ docs.

1. **`CONTEXT.md`** → Trạng thái hiện tại: phase đang làm, test count, schema snapshot.
2. **`docs/dev-history.md`** → Bảng phase status (index nhỏ ~30 dòng, links sang chi tiết).
3. **`docs/history/phase-X.md`** → Chỉ đọc phase đang implement hoặc phase trước đó nếu cần tham khảo pattern.
4. **`docs/design/0X-*.md`** → Chỉ đọc spec liên quan đến task hiện tại.
5. **`docs/bugs/README.md`** → Khi đang debug: đọc index bug trước để tránh re-investigate lỗi cũ.

**KHÔNG đọc** toàn bộ `docs/design/` hay toàn bộ `docs/history/` trừ khi cần thiết.

### Khi phát triển tính năng mới (New Phase)
- Tạo file `docs/history/phase-X-<name>.md` với template: Mục tiêu → File chính → API Endpoints → Quality Gates → Python Concepts.
- Cập nhật bảng phase trong `docs/dev-history.md` (thêm 1 dòng + link).
- Cập nhật `CONTEXT.md` sau khi phase hoàn thành.

### Khi fix lỗi / thay đổi logic
- Tạo file `docs/bugs/YYYY-MM-DD-<ten-loi>.md` với template: Triệu chứng → Root Cause → Files sửa → Cách fix → Test xác nhận.
- Thêm 1 dòng vào bảng trong `docs/bugs/README.md`.

## PROJECT LOCATION

The project root is: D:\VideCode\WebFifa (Windows).

Before making changes:
- Inspect the existing project structure and any existing backend code.
- Do not overwrite existing files without telling me.
- Use commands that work on Windows (PowerShell). No bash-only syntax in docs or scripts unless inside Docker.

## ABOUT ME (IMPORTANT)

I am learning Python (coming from Java) and moving toward Data Engineering. This is a real project for a friend AND my learning project. Therefore:
- Write clear, idiomatic, boring Python. No clever metaprogramming, no unnecessary decorators or metaclasses, no over-abstraction.
- At the end of every phase, add a section "Python concepts used" with 3-5 short bullets explaining the new language/library concepts introduced (e.g. async/await, dependency injection in FastAPI, Pydantic validation, SQLAlchemy Session).
- Comment only where the WHY is not obvious (locking, race conditions, timezone handling).
- Prefer small functions and explicit type hints on everything (`mypy --strict` must pass).

## TECH STACK

Backend:
- Python 3.12, package manager: uv (`pyproject.toml`, `uv.lock`)
- FastAPI + Uvicorn, Pydantic v2, pydantic-settings
- SQLAlchemy 2.0 (async, `AsyncSession`) + asyncpg, PostgreSQL 16
- Alembic (migrations only — never `Base.metadata.create_all()` in app code)
- Passwords: `bcrypt` package directly (do not use passlib)
- Quality: ruff (lint/format), mypy --strict (types), import-linter (layer enforcement)
- Tests: pytest, pytest-asyncio, httpx (`AsyncClient`), testcontainers-python (PostgreSQL, NEVER SQLite/H2 or mocked DB for integration tests)
- pandas is allowed ONLY inside the importer module (`app/importer/`).

Frontend: React + TypeScript + Vite, Tailwind, shadcn/ui, Axios, TanStack Query, react-router, react-hook-form + zod, native WebSocket (NO STOMP). Layout: `docs/ui/reference-draft-board.png`.
Infra: Docker, Docker Compose, Nginx. NO Redis, NO Kafka, NO Celery.

## ARCHITECTURE & LAYER RULES

Package-by-feature, layered inside each feature (`app/<feature>/`):
- `api.py`: routers + request/response schemas (Pydantic). Receive request, validate, call service, return response. NO business logic.
- `service.py`: application/use-case layer. All database transactions (`async with session.begin()`) live here.
- `domain.py`: SQLAlchemy models + pure business rules. Must NOT import `fastapi`, `api`, or `repository` modules. Turn-rotation logic is pure Python.
- `repository.py`: DB queries only.

Dependency direction: `api -> service -> domain`; `repository -> domain`. Enforced by import-linter.
Use FastAPI `Depends` for session, current user, clock, and services.

## CORE BUSINESS & SYSTEM CONSTRAINTS

- Clock Protocol: `Clock` with `now() -> datetime` (timezone-aware UTC). Inject it everywhere. NEVER call `datetime.now()` or `datetime.utcnow()` directly outside the real Clock. Tests use `FakeClock` (no `sleep`).
- Pick Transaction: Single transaction (`async with session.begin()`), `SELECT ... FOR UPDATE` on `DraftSession`, check version, validate budget feasibility, insert pick, advance turn, write `DraftEvent`, commit, broadcast over WebSocket ONLY after commit. (See `docs/design/05-business-rules.md`).
- Turn & Order: `DraftOrderStrategy` (Protocol) with `LinearOrder` (1..N, 1..N).
- Timeout: `TimeoutPolicy` (Protocol) with `AutoPickCheapest` (default) and `SkipTurn`. Background timer loop in FastAPI lifespan.
- Security: Roles `ADMIN` and `TEAM_USER`. Sessions in DB with random token cookie (HttpOnly, SameSite=Lax). TeamId resolved from authenticated user, never trusted from client.
- Errors: `DomainError` base class returning RFC 9457 JSON `{"type", "title", "status", "code", "message"}`. Unexpected errors return 500 with request id.
- Alembic & DB: Autogenerate reviewed manually; stable naming conventions on metadata; UUID primary keys; enums as VARCHAR + CHECK.

## PHASES (Execution Plan)

- **Phase 0**: Architecture, Design & Domain Model (`design.md`, `AGENTS.md`, `CHANGELOG.md`) [Done]
- **Phase 1**: Project Setup, Base Infrastructure, DB & Alembic Migrations [Done]
- **Phase 2**: Authentication & User Management (Sessions, Cookie Auth, Roles) [Done]
- **Phase 3**: Seasons & Player Catalogue / Importer Pipeline (CSV ETL, Season badges, Unaccent search) [Done]
- **Phase 4**: Tournaments, Tournament Rules (JSONB) & Teams Management [Next]
- **Phase 5**: Draft Engine (Multi-pick turns, UniqueBy player/card, Clock, Versioning)
- **Phase 6**: Draft Timer Background Task & WebSocket Realtime (`/ws/drafts/{id}`)
- **Phase 7**: Frontend Draft Board (React + Vite + Tailwind, FC Online UI)
- **Phase 8**: Matches & Bans (Match Scheduling, Simultaneous/Alternating Bans, `/ws/matches/{id}`)
- **Phase 9**: Integration Tests, E2E Verification & Hardening

## CODE QUALITY

Readable, small functions, meaningful names, no dead code, no commented-out code.
Do not add features not listed in design specs. If a requirement is ambiguous, pick the simplest sensible option, note it in the summary, and continue.
