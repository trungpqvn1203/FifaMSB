# Project Context — FIFA/FC Online Player Draft System

> **Cập nhật lần cuối**: 2026-10-08
> Đây là file "quick status card" — đọc file này đầu tiên để biết đang ở đâu.
> Chi tiết: `docs/Roadmap .md` (full phase list) · `docs/design/` (domain/API spec) · `AGENTS.md` (coding rules)

---

## 📍 Trạng thái hiện tại

**TẤT CẢ CÁC PHASE (0 ĐẾN 12) ĐÃ HOÀN THÀNH — HỆ THỐNG SẴN SÀNG TRIỂN KHAI**

| Phase | Tên | Trạng thái | Tests |
|-------|-----|-----------|-------|
| 0 + 0.5 | Architecture, Design & UI Tokens | ✅ Hoàn thành | — |
| 1 | Base Infra, DB & Alembic Migrations | ✅ Hoàn thành | 12/12 |
| 2 | Authentication & RBAC | ✅ Hoàn thành | 53/53 |
| 3 | Seasons, Player Catalogue & Importer | ✅ Hoàn thành | 74/74 |
| 4 | Tournaments, Rules JSONB & Teams | ✅ Hoàn thành | 112/112 |
| 5 | Draft Engine Core | ✅ Hoàn thành | 137/137 |
| 6 | Draft Timer & WebSocket Realtime | ✅ Hoàn thành | 156/156 |
| 7 | Frontend Foundation (React + Vite) | ✅ Hoàn thành | Build & Codegen PASS |
| 8 | Draft Board UI & WebSocket Hook | ✅ Hoàn thành | Build PASS (0 errors) |
| 9 | Matches & Bans (backend) | ✅ Hoàn thành | 169/169 (94 unit, 75 int) |
| 10 | Ban UI (Arena & WebSocket Hook) | ✅ Hoàn thành | Build & Visual Verification PASS |
| 11 | Admin UI & Operations Console | ✅ Hoàn thành | Build PASS (0 errors, 48 mypy files) |
| **12** | **E2E, Docker, Nginx & Hardening** | **✅ Hoàn thành** | **Full E2E suite, Multi-stage Docker, Compose PASS** |

---

## 🗄️ Trạng thái Database

**Migrations hiện có**:
- `0001_initial_schema.py` — seasons, players, player_seasons, users, sessions, tournaments, teams
- `0002_draft_tables.py` — draft_sessions, draft_picks, draft_events, partial unique indexes (`uq_draft_sessions_active_tournament`, `uq_draft_picks_session_player`)
- `0003_match_tables.py` — matches, match_bans, check constraints (`ck_matches_status`, `ck_matches_different_teams`), unique index (`uq_match_bans_match_banning_player`)

**Bảng đã tồn tại**:
- `seasons` — mã mùa, tên, badge_url
- `players` — cầu thủ gốc (unique: external_player_id)
- `player_seasons` — thẻ cầu thủ mỗi mùa (unique: player_id + season_id)
- `users` — tài khoản (ADMIN / TEAM_USER)
- `sessions` — session cookie token
- `tournaments` — giải đấu + rules JSONB
- `teams` — đội thi đấu
- `draft_sessions` — phiên draft, trạng thái, round, turn, turn_started_at, turn_expires_at, version
- `draft_picks` — lượt chọn của đội (lịch sử pick, salary_at_pick)
- `draft_events` — audit trail log sự kiện draft
- `matches` — trận đấu, trạng thái (SCHEDULED, BAN_PHASE, BANS_LOCKED, COMPLETED, CANCELLED), version, ban_started_at, ban_expires_at
- `match_bans` — lượt ban chiến thuật của các đội

**Extension/function đã tạo**: `pg_trgm`, `unaccent`, `immutable_unaccent()`, GIN index trên `players.name`

---

## 📁 File quan trọng cần biết

```
D:\VideCode\WebFifa\
├── AGENTS.md              ← Coding rules, architecture constraints (đọc kỹ trước khi code)
├── CONTEXT.md             ← File này — quick status card
├── docs/
│   ├── design/            ← Domain spec (tách từ design.md, xem từng section)
│   │   ├── 00-index.md    ← Tổng quan + ERD
│   │   ├── 01-domain-model.md
│   │   ├── 02-draft-engine.md
│   │   └── ...
│   ├── Roadmap .md        ← Full phase list + acceptance criteria
│   ├── dev-history.md     ← Lịch sử thực thi, danh sách file mỗi phase
│   └── CHANGELOG.md       ← Thay đổi spec qua các lần revision
├── backend/
│   ├── app/
│   │   ├── main.py        ← FastAPI app + lifespan + routers
│   │   ├── config.py      ← pydantic-settings
│   │   ├── db.py          ← async engine + session factory
│   │   ├── common/        ← Clock, DomainError, base_model
│   │   ├── auth/          ← User, Session, login/logout, dependencies
│   │   ├── player/        ← Season, Player, PlayerSeason, positions, pool_lock
│   │   ├── importer/      ← ETL pipeline (extract/transform/load)
│   │   ├── tournament/    ← [Phase 4] TournamentRules, CRUD
│   │   ├── team/          ← [Phase 4] Team CRUD
│   │   ├── draft/         ← [Phase 5] DraftSession, DraftPick, DraftEvent
│   │   └── match/         ← [Phase 9] Match, MatchBan
│   └── tests/
│       ├── unit/          ← No DB, no FastAPI
│       └── integration/   ← testcontainers PostgreSQL
└── data/
    └── sample_players.csv ← 379 player cards để test import
```

---

## ⚠️ Quyết định còn treo / Known Issues
 
- `PoolLockPolicy` đã nối `DatabasePoolLockPolicy` (kiểm tra draft PICKING/PAUSED trên DB)
- `WebSocketDraftBroadcaster` phát snapshot state thực qua WebSocket room sau commit (BR-P15)
- `DraftTimer` background loop quét turn quá hạn mỗi ~1s trong lifespan app
- `SnakeOrder` strategy chưa implement (Phase 5 đã hoàn thành `LinearOrder`)
- `AutoPickBest` timeout policy chưa implement (Phase 5 đã hoàn thành `AutoPickCheapest` + `SkipTurn`)
- Frontend foundation đã hoàn thành với React + TypeScript + Vite + TailwindCSS + TanStack Query
- Phase 9 đã hoàn thành: Matches & Tactical Bans backend (Migration 0003: `matches`, `match_bans`, endpoints API, SIMULTANEOUS ban secrecy, timer loop auto-lock BR-TM01, WebSocket `/ws/matches/{id}`).
- Phase 11 đã hoàn thành: Admin UI & Operations Console (Tournament Wizard, Draft & Ban Rules, Team & Coordinator Accounts, Player CSV Importer với Verification Card, Live Draft & Match Ops Controls).
- Phase 12 đã hoàn thành: E2E Integration Suite, Docker Multi-stage Containers, Nginx Reverse Proxy with WebSocket Streaming, Production Hardening & Documentation (`README.md`).

---

## 🚀 Trạng thái triển khai

Hệ thống đã sẵn sàng đưa vào vận hành thực tế qua:
```bash
docker compose up --build -d
```
Chi tiết cấu hình, quản trị, và kịch bản vận hành được hướng dẫn đầy đủ tại [`README.md`](file:///D:/VideCode/WebFifa/README.md).
