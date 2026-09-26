# Development History & Architecture Log — FIFA / FC Online Player Draft

Tài liệu này ghi lại chi tiết lịch sử thực thi, kiến trúc, danh sách file, API endpoints và các quyết định kỹ thuật qua từng Phase. 
**Mục đích**: Giúp tra cứu nhanh cấu trúc dự án, hỗ trợ bảo trì, sửa lỗi và giúp AI tải lại bối cảnh (context) nhanh chóng mà không tốn nhiều token.

---

## 📌 Bảng tổng hợp trạng thái các Phase

| Phase | Tên giai đoạn | Trạng thái | Số test | Quality Gates |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0 & 0.5** | Architecture, Design & UI Tokens/Gaps | **Hoàn thành** | - | Specs & Docs reviewed |
| **Phase 1** | Base Infra, DB & Alembic Migrations | **Hoàn thành** | 12/12 | Ruff, Mypy strict, Import-linter, Pytest PASS |
| **Phase 2** | Authentication & User Management | **Hoàn thành** | 53/53 | Ruff, Mypy strict, Import-linter, Pytest PASS |
| **Phase 3** | Seasons, Player Catalogue & Importer Pipeline | **Hoàn thành** | 74/74 | Ruff, Mypy strict, Import-linter, Pytest PASS |
| **Phase 4** | Tournaments, Rules (JSONB) & Teams | **Hoàn thành** | 110/110 | Ruff, Mypy strict, Import-linter, Pytest PASS |
| **Phase 5** | Draft Engine Core | **Hoàn thành** | 137/137 | Ruff, Mypy strict, Import-linter, Pytest PASS |
| **Phase 6** | Draft Timer Background Task & WebSocket Realtime | **Hoàn thành** | 156/156 | Ruff, Mypy strict, Import-linter, Pytest PASS |
| **Phase 7** | Frontend Foundation (React + Vite + Tailwind) | **Hoàn thành** | Build PASS | TypeScript 0 errors, OpenAPI Codegen PASS |
| **Phase 8** | Draft Board UI & WebSocket Hook | **Hoàn thành** | Build PASS | TypeScript 0 errors, Oxlint 0 errors, Pytest 157/157 |
| **Phase 9** | Matches & Tactical Bans (backend) | *Chờ thực hiện* | - | - |
| **Phase 10** | Ban UI | *Chờ thực hiện* | - | - |
| **Phase 11** | Admin UI | *Chờ thực hiện* | - | - |
| **Phase 12** | E2E, Docker & Hardening | *Chờ thực hiện* | - | - |

---

## 🏛️ Phase 1: Base Infrastructure, Database & Migrations

### 1. Mục tiêu & Phạm vi
- Thiết lập khung dự án backend theo mô hình **package-by-feature** chuẩn: `app/{common, auth, player, tournament, team, draft, match, importer}`.
- Cấu hình quản lý môi trường, kết nối Async SQLAlchemy 2.0 với PostgreSQL 16 qua `asyncpg`.
- Xây dựng hệ thống Domain Errors chuẩn RFC 9457 (`{"type", "title", "status", "code", "message"}`).
- Thiết lập trừu tượng thời gian: `Clock`, `SystemClock` (timezone-aware UTC) và `FakeClock` cho unit tests.
- Khởi tạo Alembic Migration 0001 khởi tạo extension `pg_trgm`, `unaccent`, hàm `immutable_unaccent` và bảng cơ sở.

### 2. Danh sách file chính
- `backend/app/config.py`: `pydantic-settings` quản lý biến môi trường.
- `backend/app/db.py`: Async engine và session factory (`AsyncSession`).
- `backend/app/common/clock.py`: Protocol `Clock`, `SystemClock`, `FakeClock`.
- `backend/app/common/base_model.py`: SQLAlchemy Base với `naming_convention` ổn định tên constraint.
- `backend/app/common/errors.py`: Base class `DomainError` và các exception nghiệp vụ.
- `backend/app/main.py`: Khởi tạo FastAPI app, cấu hình lifespan, middleware request-id, và exception handler.
- `backend/alembic/versions/0001_initial_schema.py`: Migration đầu tiên.

### 3. API Endpoints
- `GET /health`: Kiểm tra sức khỏe dịch vụ (`{"status": "ok"}`).

---

## 🔐 Phase 2: Authentication & RBAC

### 1. Mục tiêu & Phạm vi
- Quản lý người dùng (`User`) và phiên đăng nhập (`Session`).
- Phân quyền theo Role: `ADMIN` và `TEAM_USER` (gắn liền với một `team_id`).
- Xác thực bằng Session Cookie: opaque token bảo mật, cờ `HttpOnly`, `SameSite=Lax`, tự động hết hạn sau 72 giờ.
- Mã hóa mật khẩu bằng thư viện `bcrypt` trực tiếp (không qua `passlib`).
- Cung cấp CLI khởi tạo admin ban đầu: `python -m app.auth.create_admin`.

### 2. Danh sách file chính
- `backend/app/auth/domain.py`: Models `User` và `Session`.
- `backend/app/auth/repository.py`: Truy vấn DB người dùng và quản lý session token.
- `backend/app/auth/service.py`: Nghiệp vụ `login`, `logout`, `authenticate_session`, `create_user`.
- `backend/app/auth/dependencies.py`: FastAPI Depends: `get_current_user`, `require_admin`, `get_current_team`.
- `backend/app/auth/api.py`: Schemas và Routers đăng nhập/đăng xuất/me/tạo user.
- `backend/app/auth/create_admin.py`: CLI khởi tạo Admin an toàn và lũy nghiệm.

### 3. API Endpoints
- `POST /api/auth/login`: Xác thực username/password, cấp HttpOnly cookie `session_token`.
- `POST /api/auth/logout`: Xóa session khỏi DB và hủy cookie.
- `GET /api/auth/me`: Lấy thông tin user hiện tại đang đăng nhập.
- `POST /api/admin/users`: Endpoint cho ADMIN tạo user mới và gán `team_id`.

---

## ⚽ Phase 3: Seasons, Player Catalogue & Importer Pipeline (CSV ETL)

### 1. Mục tiêu & Phạm vi
- Xây dựng danh mục mùa giải (`Season`), cầu thủ gốc (`Player`), và thẻ mùa giải (`PlayerSeason`).
- Pipeline ETL nhập dữ liệu cầu thủ từ CSV theo chuẩn Data Engineering (Extract - Transform - Load):
  - **Extract**: Đọc streaming theo batch với `pandas.read_csv(chunksize=500)`. Lưu ý: thư viện `pandas` chỉ được phép dùng duy nhất trong module `app/importer/`.
  - **Transform**: Validate dữ liệu bằng Pydantic model (`ValidatedPlayerRow`): bắt buộc `external_player_id`, lương `salary >= 1`, vị trí chuẩn game. Bỏ qua và thống kê dòng lỗi.
  - **Load**: Batch upsert vào PostgreSQL với `ON CONFLICT (external_player_id) DO UPDATE` và `ON CONFLICT (player_id, season_id) DO UPDATE`. Tự tạo mùa giải nếu gặp mã mới. Đảm bảo tính lũy nghiệm (re-import nhiều lần không trùng dữ liệu, cập nhật lại lương).
- Giữ nguyên 15 vị trí gốc của FC Online (`ST`, `CF`, `LW`, `RW`, `CAM`, `CM`, `CDM`, `LM`, `RM`, `CB`, `LB`, `RB`, `LWB`, `RWB`, `GK`), gom 4 nhóm chuẩn (`FW`, `MF`, `DF`, `GK`) tại một nơi duy nhất.
- Hỗ trợ tìm kiếm tên cầu thủ tiếng Việt không dấu nhờ chỉ mục GIN `pg_trgm` và hàm `immutable_unaccent`.
- Cơ chế khóa Pool (`PoolLockPolicy`): Ngăn chặn đổi lương hoặc re-import khi Draft đang diễn ra (`POOL_LOCKED`, HTTP 422).
- Tạo tập dữ liệu mẫu `data/sample_players.csv` gồm 379 thẻ cầu thủ chân thực.

### 2. Danh sách file chính
- `backend/app/player/domain.py`: Models `Season`, `Player`, `PlayerSeason`.
- `backend/app/player/position.py`: 15 vị trí game, ánh xạ nhóm `FW|MF|DF|GK`, hàm chuẩn hóa.
- `backend/app/player/pool_lock.py`: Protocol `PoolLockPolicy` và class `DefaultPoolLockPolicy`.
- `backend/app/player/repository.py`: Truy vấn mùa giải, phân trang, lọc và tìm kiếm unaccent.
- `backend/app/player/service.py`: Nghiệp vụ mùa giải, cầu thủ, đổi lương kèm kiểm tra PoolLock.
- `backend/app/player/api.py`: Schemas và Routers cho Season, PlayerSeason, Admin player management.
- `backend/app/importer/extract.py`: Đọc file CSV dạng luồng chunk.
- `backend/app/importer/transform.py`: Lọc và validate từng dòng dữ liệu.
- `backend/app/importer/load.py`: Batch upsert vào cơ sở dữ liệu PostgreSQL.
- `backend/app/importer/pipeline.py`: Điều phối toàn bộ pipeline ETL và tạo `ImportReport`.
- `backend/app/importer/__main__.py`: CLI tool chạy ETL `python -m app.importer --file ...`.
- `data/sample_players.csv`: 379 thẻ cầu thủ FC Online mẫu (quốc tế & Việt Nam).

### 3. API Endpoints
- `GET /api/seasons`: Lấy danh sách tất cả các mùa giải.
- `POST /api/seasons`: (ADMIN) Tạo mùa giải mới.
- `GET /api/player-seasons`: Phân trang danh sách thẻ cầu thủ, lọc theo `seasonId`, `position`, `group` (`FW|MF|DF|GK`), tìm kiếm tiếng Việt không dấu qua param `search`.
- `GET /api/player-seasons/{id}`: Xem chi tiết một thẻ cầu thủ.
- `PATCH /api/admin/player-seasons/{id}`: (ADMIN) Cập nhật lương thẻ cầu thủ (`salary >= 1`), kiểm tra khóa pool.
- `POST /api/admin/players/import`: (ADMIN) Tải lên file CSV multipart để chạy ETL nhập dữ liệu.

---

## 🏆 Phase 4: Tournaments, Rules (JSONB) & Teams Management

### 1. Mục tiêu & Phạm vi
- Quản lý giải đấu (`Tournament`) và các đội tham gia (`Team`).
- Cấu hình luật giải đấu linh hoạt lưu trữ dạng **JSONB** (`tournaments.rules`) với mô hình Pydantic `TournamentRules`:
  - Roster size (`roster_size`, 1..60, default 24).
  - Quỹ lương (`budget`, default 305) với ràng buộc domain: `budget >= roster_size` (vì mỗi lượt pick tốn tối thiểu 1 lương).
  - Quy tắc duy nhất khi pick (`unique_by`: `PLAYER` hoặc `CARD`).
  - Chính sách khi hết giờ (`timeout_policy`: `AUTO_PICK_CHEAPEST` hoặc `SKIP_TURN`).
  - Danh sách mùa giải hợp lệ (`allowed_season_ids`: rỗng = cho phép tất cả).
  - Cấu hình giai đoạn cấm (`ban_count`, `ban_time_seconds`, `ban_target`, `ban_order`).
- Tự động chuyển trạng thái giải đấu: khi số đội tham gia `>= 2`, trạng thái tự động chuyển từ `DRAFT` sang `READY`. Cho phép ADMIN đánh dấu `COMPLETED`.
- Ràng buộc thứ tự chọn quân: `UNIQUE(tournament_id, draft_order)` đảm bảo mỗi đội có số thứ tự draft duy nhất trong một giải đấu; nếu trùng lặp bắt lỗi `IntegrityError` và trả về mã lỗi chuẩn RFC 9457 `DRAFT_ORDER_CONFLICT` (HTTP 409).
- Tầng schema Pydantic: hỗ trợ alias linh hoạt giữa `snake_case` (nội bộ/domain) và `camelCase` (JSON API frontend).

### 2. Danh sách file chính
- `backend/app/common/errors.py`: Bổ sung các lỗi `TournamentNotFound`, `TournamentNotReady`, `DraftOrderConflict`, `TeamNotFound`.
- `backend/app/tournament/domain.py`: SQLAlchemy models `Tournament`, `Team` và Pydantic domain model `TournamentRules`, hàm chuyển trạng thái `compute_tournament_status`.
- `backend/app/tournament/repository.py`: Truy vấn giải đấu, đội thi đấu với eager loading `selectinload(Tournament.teams)` để tránh lỗi lazy load trong môi trường async.
- `backend/app/tournament/service.py`: Nghiệp vụ giải đấu, thêm đội, kiểm tra xung đột draft_order và commit tường minh.
- `backend/app/tournament/api.py`: Schemas và Routers cho Tournaments (`/api/tournaments`) và Teams (`/api/teams`).
- `backend/tests/unit/test_tournament_rules.py`: 20 unit test kiểm tra toàn bộ validation luật giải đấu và state transition.
- `backend/tests/integration/test_tournament_api.py`: 16 integration test trên PostgreSQL thực tế (testcontainers).

### 3. API Endpoints
- `POST /api/tournaments`: (ADMIN) Tạo giải đấu mới với các luật mặc định hoặc tùy chỉnh.
- `GET /api/tournaments`: Lấy danh sách giải đấu (kèm số lượng đội).
- `GET /api/tournaments/{id}`: Xem chi tiết giải đấu (kèm danh sách đội đã tham gia).
- `POST /api/tournaments/{id}/complete`: (ADMIN) Đánh dấu giải đấu đã hoàn thành.
- `POST /api/tournaments/{id}/teams`: (ADMIN) Thêm đội vào giải đấu kèm `draft_order`. Tự động chuyển `DRAFT -> READY` khi đủ `>= 2` đội.
- `GET /api/tournaments/{id}/teams`: Lấy danh sách đội theo thứ tự draft_order.
- `GET /api/teams/{id}/roster`: Lấy danh sách cầu thủ đã pick của đội (stub rỗng ở Phase 4, Phase 5 đã liên kết DraftPick).

---

## ⚡ Phase 5: Draft Engine Core (Pick Logic, Concurrency & State Machine)

### 1. Mục tiêu & Phạm vi
- Triển khai động cơ chọn quân trung tâm (Draft Engine) theo đúng thiết kế trạng thái và nghiệp vụ (BR-P01 đến BR-P15).
- **Alembic Migration `0002_draft_tables.py`**:
  - `draft_sessions`: tournament_id, status (`WAITING`, `PICKING`, `PAUSED`, `COMPLETED`, `CANCELLED`), current_round, current_turn, current_team_id, turn_started_at, turn_expires_at, remaining_millis, rules_snapshot, version.
  - `draft_picks`: draft_session_id, team_id, player_season_id, player_id, unique_by_player, round, turn_number, salary_at_pick, picked_at.
  - `draft_events`: audit log các sự kiện (`DRAFT_STARTED`, `PICK_MADE`, `TIMEOUT_AUTO_PICK`, `TURN_SKIPPED`, `DRAFT_PAUSED`, `DRAFT_RESUMED`, `DRAFT_CANCELLED`, `DRAFT_COMPLETED`).
  - **Partial Unique Indexes**:
    - `uq_draft_sessions_active_tournament`: Đảm bảo chỉ có tối đa 1 phiên draft active (`WAITING`, `PICKING`, `PAUSED`) cho mỗi giải đấu.
    - `uq_draft_picks_session_player`: Ràng buộc cầu thủ master chỉ được chọn 1 lần trong phiên khi `unique_by_player=true`.
- **Khóa bi quan & Kiểm soát đồng thời (Pessimistic Locking & Versioning)**:
  - Sử dụng `SELECT ... FOR UPDATE` trên hàng `draft_sessions` để tuần tự hóa các yêu cầu chọn quân đồng thời.
  - So khớp `expectedVersion` (Optimistic Concurrency Control token): nếu phiên bản bị lệch trả về RFC 9457 `DRAFT_VERSION_MISMATCH` (HTTP 409).
- **Kiểm tra luật nghiệp vụ (Business Rules Validation)**:
  - **BR-P01**: Chỉ đội đang trong lượt (`current_team_id`) mới được quyền pick.
  - **BR-P02 / BR-P14**: Kiểm tra hết giờ chọn (`turn_expires_at`). Nếu quá hạn, tự động kích hoạt `apply_timeout` (auto-pick thẻ rẻ nhất hợp lệ hoặc skip turn) và trả về lỗi `TURN_EXPIRED` (HTTP 422).
  - **BR-P05**: Không được pick thẻ đã được chọn trong phiên (`CARD_ALREADY_PICKED`).
  - **BR-P08**: Nếu `uniqueBy == "PLAYER"`, cấm chọn thẻ khác của cùng cầu thủ gốc (`PLAYER_ALREADY_PICKED` 409).
  - **BR-P09**: Kiểm tra thẻ thuộc danh sách mùa giải cho phép (`allowedSeasonIds`).
  - **BR-P10 / BR-P11**: Kiểm tra tổng lương (`BUDGET_EXCEEDED`) và tính khả thi tài chính (`BUDGET_INSUFFICIENT_FOR_ROSTER`): đảm bảo ngân sách còn lại đủ chi trả tối thiểu cho các lượt pick tiếp theo trong roster.
  - **BR-P12**: Chuyển lượt chọn (`LinearOrder`): tự động bỏ qua các đội đã đủ quân, tăng round/turn hoặc kết thúc phiên (`COMPLETED`).
- **Khóa kho thẻ (Pool Locking)**:
  - Triển khai `DatabasePoolLockPolicy` kiểm tra trên database nếu có bất kỳ draft nào đang `PICKING` hoặc `PAUSED`, ngăn chặn việc sửa lương thẻ qua API admin (`POOL_LOCKED` 422).
- **Kiến trúc Broadcast & Layer Isolation**:
  - `DraftBroadcaster` protocol: phát sự kiện sau khi database transaction đã commit thành công (`NoOpDraftBroadcaster` ở Phase 5, sẽ gắn WebSocket realtime ở Phase 6).
  - Tách biệt tầng đọc dữ liệu bảng xếp hạng / chi tiết draft: `DraftService.get_draft_detail_data` trả về `TeamDraftStatusData`, tuân thủ 100% hợp đồng phân tầng `import-linter`.

### 2. Danh sách file chính
- `backend/alembic/versions/0002_draft_tables.py`: Migration tạo 3 bảng draft và các index/ràng buộc.
- `backend/app/common/errors.py`: Bổ sung mã lỗi `DraftVersionMismatch` (HTTP 409).
- `backend/app/draft/domain.py`: SQLAlchemy models (`DraftSession`, `DraftPick`, `DraftEvent`), pure domain dataclasses (`TeamTurnInfo`, `TeamDraftStatusData`, `TurnAdvanceResult`), chiến lược xoay tua `LinearOrder(DraftOrderStrategy)` và hàm pure logic `is_budget_feasible()`.
- `backend/app/draft/broadcaster.py`: Protocol `DraftBroadcaster`, `NoOpDraftBroadcaster`, dependency `get_draft_broadcaster`.
- `backend/app/draft/repository.py`: Truy vấn draft atomic (`get_draft_session_by_id` với `for_update=True`), danh sách pick, tính toán budget used, tìm thẻ giá rẻ nhất tự động pick (`find_available_cards_for_autopick`), ghi nhận event audit.
- `backend/app/draft/service.py`: Nghiệp vụ `DraftService` quản lý toàn bộ transaction `start_draft`, `make_pick`, `pause_draft`, `resume_draft`, `cancel_draft`, `apply_timeout`.
- `backend/app/draft/api.py`: Schemas Pydantic (`DraftPickRequest`, `DraftDetailResponse`, `DraftPickBoardItem`, v.v.) và Endpoints router.
- `backend/app/player/pool_lock.py`: Thay thế stub bằng `DatabasePoolLockPolicy(session: AsyncSession)` truy vấn thực tế.
- `backend/app/tournament/service.py` & `repository.py`: Triển khai `get_team_roster(team_id)` truy vấn trực tiếp các thẻ đã pick.
- `backend/app/main.py`: Đăng ký routers `tournaments_draft_router` và `drafts_router`.
- `backend/tests/unit/test_draft_domain.py`: 11 unit tests cho turn order và budget feasibility (không cần DB).
- `backend/tests/integration/test_draft_api.py`: 16 integration tests bao phủ trọn vẹn toàn bộ các luồng chọn quân, concurrency 2 pick đồng thời, version mismatch, timeout, budget feasibility, unique theo player/card, pause/resume/cancel.

### 3. API Endpoints
- `POST /api/tournaments/{id}/draft/start`: (ADMIN) Khởi tạo phiên draft từ giải đấu có trạng thái `READY`.
- `GET /api/drafts/{id}`: Xem chi tiết trạng thái phiên draft (round, turn, thời gian còn lại, danh sách các đội và ngân sách đã dùng).
- `GET /api/drafts/{id}/picks`: Xem bảng lịch sử toàn bộ các lượt pick theo thứ tự thời gian.
- `POST /api/drafts/{id}/picks`: Đội đang trong lượt chọn thẻ cầu thủ (`expectedVersion`, `playerSeasonId`).
- `POST /api/drafts/{id}/pause`: (ADMIN) Tạm dừng phiên draft, tính toán và lưu `remaining_millis`.
- `POST /api/drafts/{id}/resume`: (ADMIN) Tiếp tục phiên draft, tính toán lại thời điểm hết hạn từ `remaining_millis`.
- `POST /api/drafts/{id}/cancel`: (ADMIN) Hủy bỏ phiên draft.
- `GET /api/teams/{id}/roster`: Lấy danh sách toàn bộ các thẻ cầu thủ đã pick thành công của đội.

---

## ⚡ Phase 6: Draft Timer Background Task & WebSocket Realtime

### 1. Mục tiêu & Phạm vi
- Triển khai kiến trúc **Real-time Draft Board** sử dụng Native WebSockets (không dùng STOMP) theo mô hình 1 Uvicorn worker (In-Memory Pub/Sub, không Redis/Kafka/Celery).
- **WebSocket Endpoint `/ws/drafts/{draft_id}`**:
  - Kiểm tra bảo mật handshake: xác thực Session Cookie, kiểm tra Origin header theo `allowed_origins` (từ chối ngay với mã `WS_1008_POLICY_VIOLATION` nếu vi phạm).
  - Phân quyền giải đấu: chỉ cho phép `ADMIN` hoặc `TEAM_USER` thuộc các đội của giải đấu tương ứng truy cập room.
  - Gửi ngay **Initial Snapshot** chứa toàn bộ trạng thái draft (`DraftState`, `version`, `serverTime`, `teams`, `picks`, `currentRound`, `currentTurn`, v.v.) ngay khi kết nối thành công.
  - Cơ chế Heartbeat: phản hồi client `ping` -> `pong` và tự động dọn dẹp các socket ngắt kết nối/bị đứt (`dead_sockets`).
- **Real-time Broadcaster (`WebSocketDraftBroadcaster`)**:
  - Thay thế `NoOpDraftBroadcaster` của Phase 5.
  - Tuân thủ nghiêm ngặt **BR-P15**: Không bao giờ phát socket bên trong database transaction; chỉ phát thông điệp sau khi `session.commit()` thành công.
  - Phát broadcast đầy đủ snapshot sau mỗi sự kiện: `PICK_MADE`, `TIMEOUT_AUTO_PICK`, `TURN_SKIPPED`, `DRAFT_PAUSED`, `DRAFT_RESUMED`, `DRAFT_CANCELLED`, `DRAFT_COMPLETED`.
- **Background Timer (`DraftTimer`)**:
  - Chạy background loop định kỳ (~1 giây) trong FastAPI Lifespan (`asynccontextmanager`).
  - Quét các phiên draft đang `PICKING` có `turn_expires_at <= now()`.
  - Thực thi `apply_timeout` độc lập trong transaction riêng cho từng draft quá hạn (auto-pick thẻ rẻ nhất hợp lệ hoặc skip turn) và phát broadcast `TIMEOUT_AUTO_PICK`.
  - Tắt an toàn (graceful shutdown) khi ứng dụng dừng thông qua `asyncio.Event` và `task.cancel()`.

### 2. Danh sách file chính
- `backend/app/draft/ws.py`: `ConnectionManager` (quản lý socket theo `draft_id`), endpoint `/ws/drafts/{draft_id}`, validate origin, session cookie auth và room authorization.
- `backend/app/draft/broadcaster.py`: `WebSocketDraftBroadcaster` kết nối trực tiếp với `ConnectionManager`.
- `backend/app/draft/timer.py`: `DraftTimer` background task với `check_and_apply_timeouts()` và `run_loop(stop_event)`.
- `backend/app/draft/repository.py`: Bổ sung `find_expired_draft_ids(session, now)` và tối ưu nạp eager relationships (`joinedload`) cho thẻ tự động pick.
- `backend/app/draft/service.py`: Tích hợp phát broadcast sau commit trong toàn bộ các luồng trạng thái (`start`, `pick`, `pause`, `resume`, `cancel`, `timeout`) và helper xây dựng snapshot payload.
- `backend/app/db.py`: Bổ sung `get_session_factory()` và `set_session_factory()` cho phép dynamic factory switching linh hoạt.
- `backend/app/main.py`: Đăng ký `ws_router` và khởi động/dừng `DraftTimer` background loop trong `lifespan`.
- `backend/tests/unit/test_draft_ws.py`: 8 unit tests kiểm tra `ConnectionManager` (connect, disconnect, broadcast room isolation, dọn dead sockets) và kiểm tra Origin validation.
- `backend/tests/unit/test_draft_timer.py`: 3 unit tests kiểm tra `DraftTimer` với `FakeClock` (không gọi sleep).
- `backend/tests/integration/test_draft_ws_api.py`: 8 integration tests trên real PostgreSQL container: handshake auth 1008, invalid origin 1008, unpermitted team user 1008, initial snapshot, pick broadcast 2 clients, ping/pong heartbeat, pause/resume broadcast, và background timer auto-pick broadcast.

### 3. API & WebSocket Specifications
- `WS /ws/drafts/{id}`:
  - **Handshake**: Cookie `session_token` + header `Origin`.
  - **Connect**: Nhận ngay message JSON `INITIAL_SNAPSHOT` có `draftId`, `version`, `serverTime`, `teams`, `picks`.
  - **Heartbeat**: Gửi text `ping` -> nhận text `pong`.
  - **Broadcast Events**: `PICK_MADE`, `TIMEOUT_AUTO_PICK`, `DRAFT_PAUSED`, `DRAFT_RESUMED`, `DRAFT_COMPLETED`.

---

## 🎨 Phase 7: Frontend Foundation (React + TypeScript + Vite + Tailwind + Auth)

### 1. Mục tiêu & Phạm vi
- Khởi tạo kiến trúc Frontend bằng **React 19 + TypeScript + Vite** đặt tại thư mục `frontend/`.
- Cấu hình hệ thống Design Tokens theo phong cách **Esports Championship Dark Broadcast HUD** dựa trên `docs/ui/tokens.md`:
  - Bảng màu: Nền tối sâu `bg-app-void` (`#0B0D0E`), các khối panel `surface-panel` (`#13151B`), `surface-card` (`#171922`), `surface-elevated` (`#1F232E`), viền `border-default` (`#242836`), `border-active` (`#3DFF6B`).
  - Điểm nhấn Neon phát sáng: `neon` (`#3DFF6B`), `danger` (`#FF3B4E`), `warning` (`#F5C518`), `cyan` (`#00E3FD`), hiệu ứng đổ bóng `glow-neon`, `glow-danger`, `glow-gold`.
  - Hệ thống phông chữ thể thao: `Space Grotesk` (tiêu đề display), `JetBrains Mono` (đồng hồ số, chỉ số lương, mã tag), `Inter` (nội dung body).
- **Sinh Type Tự Động (OpenAPI TypeScript Codegen)**:
  - Tạo script Python `backend/scripts/export_openapi.py` trích xuất schema FastAPI ra `frontend/src/types/openapi.json`.
  - Sử dụng `openapi-typescript` biên dịch tự động ra `frontend/src/types/api.ts` với đầy đủ các interface của Request/Response schemas, đảm bảo tính an toàn kiểu (type-safety) tuyệt đối giữa Backend và Frontend.
- **Tầng API Client & Xác Thực Cookie (`withCredentials`)**:
  - Khởi tạo `apiClient` bằng Axios hỗ trợ tự động gửi/nhận Cookie Session `session_token` (HttpOnly).
  - Tích hợp interceptor bóc tách cấu trúc lỗi chuẩn RFC 9457 JSON (`ApiError` có `code`, `message`, `status`).
  - Xây dựng `AuthContext` quản lý trạng thái đăng nhập, tự động phục hồi phiên qua `GET /api/auth/me`, cung cấp hàm `login()` và `logout()`.
- **Cấu hình Vite Proxy Thông Minh**:
  - Proxy đường dẫn `/api` về backend `http://127.0.0.1:8000` (giữ nguyên cookie cùng origin).
  - Proxy đường dẫn `/ws` về WebSocket server `ws://127.0.0.1:8000` với cờ `ws: true`.
- **Giao Diện Trang Quản Lý Giải Đấu (Tournaments)**:
  - `LoginPage` (`/login`): Giao diện đăng nhập esports HUD, form validation, thông báo lỗi RFC 9457 rõ ràng, tự động chuyển hướng khi đã có phiên.
  - `TournamentListPage` (`/tournaments`): Danh sách giải đấu với thẻ hiển thị chỉ số luật (ngân sách, roster, thời gian lượt, số lượt cấm), nút tạo giải đấu mới (Modal form dành cho Admin).
  - `TournamentDetailPage` (`/tournaments/:id`): Xem chi tiết luật thi đấu, danh sách các đội đăng ký kèm thanh tiến độ ngân sách, nút Admin thêm đội và nút bắt đầu phiên Draft (`POST /api/tournaments/{id}/draft/start`).
  - `ProtectedRoute`: Chặn truy cập trái phép, tự động điều hướng về `/login` và kiểm soát phân quyền Role (`ADMIN` / `TEAM_USER`).

### 2. Danh sách file chính
- `frontend/package.json`: Khai báo dependencies React, TanStack Query, Axios, Tailwind, Lucide React, openapi-typescript.
- `frontend/vite.config.ts`: Cấu hình path alias `@/` và proxy `/api`, `/ws`.
- `frontend/tailwind.config.js` & `src/index.css`: Cấu hình màu sắc, typography và hiệu ứng phát sáng HUD.
- `backend/scripts/export_openapi.py`: Script xuất FastAPI OpenAPI schema.
- `frontend/src/types/api.ts` & `src/types/domain.ts`: Định nghĩa kiểu dữ liệu đồng bộ từ API.
- `frontend/src/lib/api-client.ts`: Axios client kèm xử lý RFC 9457 `ApiError`.
- `frontend/src/context/AuthContext.tsx`: React Context quản lý phiên đăng nhập người dùng.
- `frontend/src/components/ui/`: Bộ linh kiện UI tái sử dụng (`Button`, `Badge`, `Input`, `Card`, `Modal`).
- `frontend/src/components/layout/AppShell.tsx`: Header HUD thể thao hiển thị logo, trạng thái Live, thông tin tài khoản và nút Logout.
- `frontend/src/pages/LoginPage.tsx`: Trang đăng nhập phong cách Esports.
- `frontend/src/pages/TournamentListPage.tsx`: Trang danh sách và tạo mới giải đấu.
- `frontend/src/pages/TournamentDetailPage.tsx`: Trang chi tiết giải đấu, danh sách đội bóng và khởi động Draft.
- `frontend/src/routes/ProtectedRoute.tsx`: Bộ định tuyến bảo vệ quyền truy cập.
- `frontend/src/App.tsx`: Khởi tạo QueryClientProvider, AuthProvider và Routes.

---

## 💡 Tổng kết kiến thức Python quan trọng đã dùng (Tra cứu học tập)

1. **Async SQLAlchemy 2.0 & `AsyncSession`**:
   - Dùng cú pháp truy vấn hiện đại `select(...)`, `join()`, `joinedload()` để nạp eager relationships mà không sinh truy vấn N+1.
   - Quản lý transaction tường minh: gọi `await session.commit()` / `await session.flush()` trực tiếp từ session được inject bởi FastAPI.
2. **PostgreSQL Batch Upsert (`pg_insert.on_conflict_do_update`)**:
   - Sử dụng `sqlalchemy.dialects.postgresql.insert` để thực hiện upsert hàng loạt trong một truy vấn SQL, đảm bảo tính lũy nghiệm (idempotency).
3. **Pydantic v2 Cross-Field Validation (`@model_validator(mode="after")`)**:
   - Xác thực nghiệp vụ phức tạp giữa nhiều trường cùng lúc (ví dụ: `budget >= roster_size` vì mỗi pick tốn tối thiểu 1 lương). Chạy tự động cả ở tầng request schema lẫn domain model.
4. **Tránh lỗi `MissingGreenlet` trong Async SQLAlchemy với `selectinload`**:
   - Sau khi gọi `session.commit()`, SQLAlchemy mặc định expire toàn bộ attributes của model. Trong môi trường async, việc truy cập quan hệ (relationship) chưa được nạp sẵn sẽ kích hoạt lazy load ngầm và quăng ngoại lệ `MissingGreenlet`. Giải pháp: dùng `selectinload` hoặc query re-fetch đối tượng kèm quan hệ trước khi serialize sang Pydantic schema.
5. **Bắt và ánh xạ lỗi toàn vẹn dữ liệu (`IntegrityError`)**:
   - Bắt lỗi `IntegrityError` từ SQLAlchemy/PostgreSQL khi vi phạm constraint `UNIQUE(tournament_id, draft_order)` và ánh xạ thành `DraftOrderConflict` (RFC 9457 JSON 409) thay vì để lỗi 500 thoát ra ngoài.
6. **Streaming Data Processing với Pandas (`chunksize`)**:
   - Đọc dữ liệu lớn theo từng phần (`chunksize=500`) dưới dạng generator/iterator, tránh tràn RAM khi import file CSV hàng chục nghìn dòng.
7. **Pydantic v2 `serialization_alias` & `populate_by_name`**:
   - Cầu nối hoàn hảo giữa quy ước mã nguồn Python (`snake_case`) và chuẩn JSON API (`camelCase`), tự động chuyển đổi khi serialize/deserialize.
8. **FastAPI Dependency Injection (`Depends`)**:
   - Tách rời hoàn toàn tầng Presentation và Service/Repository. Dễ dàng inject `Clock`, `AsyncSession`, `CurrentUser`, hoặc mock trong unit test.
9. **Import Linter Contracts**:
   - Thiết lập quy tắc kiến trúc tầng nghiêm ngặt (ví dụ: Domain không được import API; `pandas` bị cô lập hoàn toàn chỉ nằm trong `importer`), phát hiện vi phạm kiến trúc ngay trong CI.
10. **Pessimistic Locking (`with_for_update()`) & Row-Level Concurrency**:
    - Dùng `select(...).with_for_update()` của SQLAlchemy để lock hàng `draft_sessions` tại PostgreSQL trong transaction (`async with session.begin()`). Mọi request pick đồng thời đều bị block tuần tự cho tới khi transaction commit hoặc rollback, giải quyết triệt để race condition chọn cùng một thẻ.
11. **Optimistic Version Token (`expectedVersion`)**:
    - Kết hợp kiểm tra `draft.version == expected_version` ngay sau khi lấy khóa row. Nếu trạng thái phiên vừa bị timeout tự động xử lý hoặc đã sang turn khác, client lập tức nhận HTTP 409 `DRAFT_VERSION_MISMATCH` mà không làm sai lệch dữ liệu.
12. **PostgreSQL Partial Unique Indexes (`CREATE UNIQUE INDEX ... WHERE ...`)**:
    - Tận dụng chỉ mục có điều kiện trong PostgreSQL thông qua Alembic migration:
      - `uq_draft_sessions_active_tournament`: Đảm bảo chỉ 1 phiên draft active (`WAITING`, `PICKING`, `PAUSED`) trên mỗi giải đấu.
      - `uq_draft_picks_session_player`: Đảm bảo 1 cầu thủ master chỉ bị pick 1 lần khi `unique_by_player = true`.
13. **Protocol-based Broadcaster Pattern (`typing.Protocol`)**:
    - Áp dụng kỹ thuật Structural Subtyping (Duck Typing an toàn kiểu tĩnh) định nghĩa `DraftBroadcaster`. Cho phép Phase 5 cắm `NoOpDraftBroadcaster` mà không phụ thuộc vào WebSocket (sẽ triển khai ở Phase 6), và đảm bảo sự kiện chỉ phát ra ngoài SAU KHI transaction DB đã commit thành công.
14. **Cross-Feature Read Model (Tổng hợp dữ liệu liên module đúng kiến trúc)**:
    - Để tuân thủ hợp đồng kiến trúc cấm `app.draft.api` gọi trực tiếp `app.tournament.repository`, logic tổng hợp dữ liệu danh sách đội và ngân sách đã dùng được đưa vào `DraftService.get_draft_detail_data` và trả về `TeamDraftStatusData`. Giữ vững 100% tính toàn vẹn của layer rules.
15. **In-Memory Pub/Sub Room Manager (`defaultdict(set)`)**:
    - Quản lý tập hợp các WebSocket connection theo từng phòng `draft_id` trên single Uvicorn worker. Khi một client gửi tin hoặc sự kiện DB commit xảy ra, server lặp qua danh sách socket để `send_json`. Tự động cô lập các ngoại lệ gửi tin để xóa sạch dead sockets mà không ảnh hưởng tới các kết nối còn sống.
16. **FastAPI Lifespan Background Task (`asyncio.create_task` & `asyncio.Event`)**:
    - Chạy tiến trình nền kiểm tra timeout trong suốt vòng đời ứng dụng bằng `lifespan` handler. Khi ứng dụng nhận tín hiệu shutdown, background loop được hủy an toàn thông qua `stop_event.set()` và `timer_task.cancel()`, kết hợp `contextlib.suppress(asyncio.CancelledError)` để đóng sạch tài nguyên.
17. **Tách biệt Event Loop trong Kiểm thử Asynchronous (Async ASGI WebSocket Testing)**:
    - `Starlette.testclient.TestClient` chạy một BlockingPortal trên một thread/loop độc lập, điều này sẽ xung đột với connection pool của `asyncpg` vốn gắn chặt vào event loop của `pytest-asyncio`. Giải pháp tối ưu: Xây dựng helper test client async thuần túy giao tiếp trực tiếp qua chuẩn ASGI (`scope, receive, send`) trên cùng một event loop, đảm bảo kiểm thử chính xác và mượt mà các luồng WebSocket với real database.

---

## 🎮 Phase 8: Draft Board UI & WebSocket Hook

### 1. Mục tiêu & Phạm vi
- Triển khai giao diện phòng Draft trực tiếp (**Draft Board UI**) bám sát 100% nguyên mẫu `docs/ui/draft-board.html` và hệ Design Tokens trong `docs/ui/tokens.md`.
- Phát triển custom hook **`useDraftSocket`** kết nối native WebSocket với khả năng tự động bắt cookie, bù trừ lệch giờ server (`serverTimeOffset`), đếm ngược đồng hồ HUD chính xác, tự động reconnect với exponential backoff và phát hiện lệch phiên (`version gap`) để kích hoạt resync.
- Bổ sung endpoint backend `GET /api/tournaments/{tournament_id}/draft` lấy draft session hiện hành của giải đấu.
- Xây dựng hệ thống UI Components hoàn chỉnh:
  - `DraftHeader`: Header broadcast HUD, turn clock số to (`00:30`), trạng thái kết nối realtime, điều khiển Admin (Pause / Resume / Cancel).
  - `DraftTeamHeader`: Cột tiêu đề các đội tham gia kèm nhãn LIVE TURN, hiệu ứng phát sáng neon khi đang đến lượt, thanh tiến trình Salary Cap.
  - `DraftMatrix`: Lưới hiển thị các vòng pick (1..N rounds), ô thẻ đã pick (vị trí, mùa giải, tên, lương), ô đang chọn nhấp nháy neon ("SELECTING NOW..."), ô chờ lượt.
  - `WarRoomSidebar`: Sidebar mô phỏng 4 camera war room broadcast, hiển thị trạng thái LIVE FEED / DRAFTING, NEXT PICK, STANDBY.
  - `PlayerPoolDrawer`: Bảng chọn cầu thủ chiến thuật với chip lọc vị trí chi tiết, tìm kiếm không dấu, sắp xếp lương / OVR, kiểm tra trần lương và nút PICK PLAYER.

### 2. Danh sách file chính
- `backend/app/draft/service.py`: Thêm method `get_latest_draft_for_tournament`.
- `backend/app/draft/api.py`: Thêm route `GET /api/tournaments/{tournament_id}/draft`.
- `backend/tests/integration/test_draft_api.py`: Thêm integration test `test_get_tournament_draft`.
- `frontend/src/lib/draft-utils.ts`: Helper định dạng màu vị trí bóng đá FC Online, format đồng hồ, trích xuất mã viết tắt đội.
- `frontend/src/hooks/useDraftSocket.ts`: Native WebSocket hook với cơ chế heartbeat, time offset sync, và backoff reconnect.
- `frontend/src/components/draft/DraftHeader.tsx`: Header HUD thời gian thực.
- `frontend/src/components/draft/DraftTeamHeader.tsx`: Header phân cột đội và thanh ngân sách.
- `frontend/src/components/draft/DraftMatrix.tsx`: Lưới ma trận các vòng pick.
- `frontend/src/components/draft/WarRoomSidebar.tsx`: Sidebar broadcast team war room feeds.
- `frontend/src/components/draft/PlayerPoolDrawer.tsx`: Khối chọn và tìm kiếm cầu thủ trong pool.
- `frontend/src/pages/DraftBoardPage.tsx`: Trang chính phòng Draft trực tiếp.
- `frontend/src/pages/TournamentDetailPage.tsx`: Cập nhật nút điều hướng "Enter Draft Arena".
- `frontend/src/App.tsx`: Đăng ký routes `/tournaments/:tournamentId/draft` và `/drafts/:draftId`.

### 3. Khái niệm Kỹ thuật & Python/TypeScript Sử dụng
1. **Server-Client Time Synchronization (`serverTimeOffset`)**:
   - Khi WebSocket client nhận snapshot từ server mang theo timestamp ISO `serverTime`, client tính độ lệch `offset = serverTime - Date.now()`. Mọi phép tính đếm ngược từ `turnExpiresAt` được trừ đi khoảng bù `serverTimeOffset`, loại bỏ hoàn toàn hiện tượng lệch giây do sai lệch đồng hồ hệ thống giữa máy client và server.
2. **Version Gap Detection & Self-Healing Resync**:
   - WebSocket hook theo dõi số `version` của draft. Nếu một gói tin đến mang `version > lastKnownVersion + 1` (cho thấy đã bỏ lỡ gói tin trung gian do mạng giật), hook lập tức kích hoạt invalidation trên TanStack Query để kéo lại toàn bộ state và danh sách picks mới nhất từ REST API.
3. **Optimistic Locking Guard on Client (`expectedVersion`)**:
   - Thao tác gửi pick truyền kèm `expectedVersion`. Nhờ đó, nếu người dùng pick chậm trong tích tắc khi server vừa chuyển turn do timeout, request bị chặn an toàn với thông báo rõ ràng mà không gây sai lệch dữ liệu.
4. **Pure CSS Design Tokens Alignment**:
   - Chuyển tải chính xác bảng màu Esports Broadcast HUD (`#0B0D0E`, `#13151B`, `#3DFF6B`, `#FF3B4E`, `#F5C518`) và typography (`Space Grotesk`, `JetBrains Mono`, `Inter`) vào Tailwind CSS và các UI components tái sử dụng cao.

---

## ⚔️ Phase 9: Matches & Tactical Bans (Backend)

### 1. Mục tiêu & Phạm vi
- Tạo migration Alembic `0003_match_tables.py` thiết lập hai bảng `matches` và `match_bans` kèm đầy đủ CHECK constraints (`ck_matches_status`, `ck_matches_different_teams`), khóa ngoại CASCADE, và chỉ mục unique (`uq_match_bans_match_banning_player`).
- Triển khai pure domain models `Match`, `MatchBan` tuân thủ nghiêm ngặt quy tắc kiến trúc tầng (API -> Service -> Domain; Repository -> Domain).
- Thực thi toàn bộ business rules cho trận đấu & cấm chọn chiến thuật:
  - `BR-M01`: Thẻ cầu thủ bị cấm bắt buộc phải thuộc danh sách đội hình đã draft (`DraftPick`) của đội bị nhắm mục tiêu (`is_card_drafted_by_team`).
  - `BR-M02`: Giới hạn số lượng ban mỗi đội theo cấu hình giải (`banCount`, mặc định 5).
  - `BR-M03`: Định tuyến mục tiêu ban theo `banTarget` (`OPPONENT_ROSTER` vs `OWN_ROSTER`).
  - `BR-M04`: Cơ chế bảo mật cấm chọn đồng thời (`SIMULTANEOUS` ban secrecy) — trong trạng thái `BAN_PHASE`, mỗi đội chỉ nhìn thấy chi tiết các lượt cấm của mình và số lượng ban của đối thủ; chỉ khi chuyển sang `BANS_LOCKED` hoặc `COMPLETED`, toàn bộ danh sách ban mới được công khai cho tất cả người xem.
  - `BR-M05`: Xác nhận cấm chọn (`home_confirmed`, `away_confirmed`). Khi cả hai đội cùng xác nhận hoặc hết giờ, trận đấu tự động khóa cấm chọn (`BANS_LOCKED`).
  - `BR-M06`: Khóa bi quan `SELECT ... FOR UPDATE` bảo vệ dữ liệu trong phiên giao dịch, tăng monotonic `version`, commit trước khi phát broadcast.
  - `BR-TM01`: Mở rộng background timer loop trong lifespan ứng dụng để tự động khóa các trận đấu hết giờ cấm chọn (`check_and_lock_expired_matches`).
- Thiết lập kênh WebSocket `/ws/matches/{match_id}` với xác thực cookie/token, xác thực Origin, handshake ban đầu và heartbeat ping/pong.
- Xây dựng trọn bộ REST API endpoints cho xếp lịch trận đấu, quản trị ban, xác nhận ban, hoàn tất trận đấu.
- Kiểm thử tích hợp toàn diện trên PostgreSQL thực (testcontainers): 100% đạt 169/169 tests (94 unit, 75 integration).

### 2. Danh sách file chính
- `backend/alembic/versions/0003_match_tables.py`: Migration DDL bảng `matches` và `match_bans`.
- `backend/app/common/errors.py`: Bổ sung domain errors `TeamNotInMatch`, `BanNotFound`, `PlayerAlreadyBanned`, `MatchNotReady`, `SameTeamMatch`.
- `backend/app/match/domain.py`: Models SQLAlchemy `Match`, `MatchBan` và domain methods thuần logic.
- `backend/app/match/repository.py`: Truy vấn DB, kiểm tra cầu thủ thuộc roster, lấy match kèm eager-loading `selectinload`.
- `backend/app/match/broadcaster.py`: Quản lý kết nối WebSocket phòng đấu và phát thông điệp sau commit.
- `backend/app/match/service.py`: Nghiệp vụ xếp lịch trận đấu, submit ban, delete ban, confirm bans, lọc bí mật `build_match_view_dict`.
- `backend/app/draft/timer.py`: Mở rộng timer loop kiểm tra timeout ban và auto-lock trận đấu.
- `backend/app/match/ws.py`: Endpoint `/ws/matches/{match_id}` với kiểm tra quyền xem theo đội / Admin.
- `backend/app/match/api.py`: Các routes REST API cho giải đấu và trận đấu (`/api/tournaments/{id}/matches`, `/api/matches/{id}/*`).
- `backend/app/auth/dependencies.py`: Bổ sung `get_optional_current_user` cho phép truy cập linh hoạt không bắt buộc đăng nhập (cho spectator).
- `backend/app/main.py`: Đăng ký `tournaments_match_router`, `matches_router`, `match_ws_router`.
- `backend/tests/unit/test_match_domain.py`: 6 unit tests kiểm tra logic cấm chọn, đếm ngược, và lọc bảo mật SIMULTANEOUS.
- `backend/tests/integration/test_match_api.py`: 6 integration tests kiểm thử toàn diện vòng đời trận đấu, bảo mật ban và xác nhận.
- `backend/tests/integration/test_migration.py`: Cập nhật xác minh bảng `matches` và `match_bans`.

### 3. Khái niệm Python sử dụng (Python Concepts Used)
1. **SELECT FOR UPDATE với Quan hệ Outer Join (`selectinload` vs `joinedload`)**:
   - Khi thực hiện khóa bi quan hàng dữ liệu (`SELECT ... FOR UPDATE`), PostgreSQL không cho phép áp dụng khóa lên nhánh nullable của một `LEFT OUTER JOIN` (vốn được sinh ra bởi `joinedload`). Giải pháp là sử dụng `selectinload` để tải các mối quan hệ (teams, bans, player_season) qua các câu lệnh SELECT độc lập sau đó, giữ cho câu lệnh khóa ban đầu hoàn toàn đơn giản và an toàn tuyệt đối.
2. **Optional FastAPI Dependency Injection (`get_optional_current_user`)**:
   - Khác với `get_current_user` vốn raise ngay `Unauthorized (401)` khi không có session cookie, dependency tùy chọn đọc request cookie/header và trả về `User | None`. Nhờ đó, endpoint GET chi tiết trận đấu cho phép cả khán giả chưa đăng nhập lẫn người chơi trong cuộc truy cập, đồng thời định tuyến chính xác dữ liệu mật cần lọc qua `viewer_team_id`.
3. **Pydantic Model Validator sau Khởi tạo (`@model_validator(mode='after')`)**:
   - Sử dụng decorator `@model_validator(mode="after")` trong Pydantic v2 để thẩm định các ràng buộc logic liên quan đến nhiều trường cùng lúc (ví dụ kiểm tra `home_team_id != away_team_id`). Lỗi phát sinh trong validator tự động được FastAPI chuyển thành mã lỗi HTTP 422 Unprocessable Entity chuẩn RFC.
4. **Phản hồi Lọc Bảo mật Động (Role-Based Dynamic View Projection)**:
   - Thay vì trả về toàn bộ dữ liệu thô từ database, service sử dụng hàm thuần Python `build_match_view_dict` để chiếu (project) dữ liệu: trong chế độ cấm bí mật (`SIMULTANEOUS`), mỗi đội chỉ được nhìn thấy thẻ của mình và con số đếm thẻ của đối phương. Chỉ khi cả hai xác nhận xong (`BANS_LOCKED`), phép chiếu mới mở khóa toàn bộ danh sách thẻ cho tất cả các bên.

---

## 🛠️ Nhật ký Sửa đổi & Điều chỉnh theo Yêu cầu (Feedback & Fix Log)

> **Mục đích**: Ghi lại mọi chỉnh sửa phát sinh khi bạn kiểm tra web, test chức năng, hoặc yêu cầu điều chỉnh logic giữa các Phase. Mỗi lần sửa code sẽ được lưu lại theo format bên dưới để AI và bạn luôn biết rõ lý do thay đổi, tránh sửa nhầm hoặc mất bối cảnh (context), đồng thời tiết kiệm tối đa chi phí token.

### Format ghi nhận:
```markdown
### [YYYY-MM-DD] <Mô tả ngắn gọn yêu cầu / lỗi>
- **Vấn đề / Yêu cầu**: Bạn gặp hiện tượng gì hoặc muốn đổi logic ra sao?
- **Nguyên nhân**: Tại sao lại xảy ra vấn đề đó?
- **Các file đã sửa**: `app/...`, `tests/...`
- **Cách xử lý**: Giải thích ngắn gọn cách fix/thay đổi.
- **Kết quả kiểm thử**: Test nào đã chạy lại và xác nhận thành công.
```

*(Mỗi khi bạn check web hoặc yêu cầu sửa lỗi/thay đổi tính năng, tôi sẽ tự động ghi nhật ký vào mục này).*

