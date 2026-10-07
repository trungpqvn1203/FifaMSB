# Phase 5: Draft Engine Core (Pick Logic, Concurrency & State Machine)

## 1. Mục tiêu & Phạm vi
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

## 2. Danh sách file chính
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

## 3. API Endpoints
- `POST /api/tournaments/{id}/draft/start`: (ADMIN) Khởi tạo phiên draft từ giải đấu có trạng thái `READY`.
- `GET /api/drafts/{id}`: Xem chi tiết trạng thái phiên draft (round, turn, thời gian còn lại, danh sách các đội và ngân sách đã dùng).
- `GET /api/drafts/{id}/picks`: Xem bảng lịch sử toàn bộ các lượt pick theo thứ tự thời gian.
- `POST /api/drafts/{id}/picks`: Đội đang trong lượt chọn thẻ cầu thủ (`expectedVersion`, `playerSeasonId`).
- `POST /api/drafts/{id}/pause`: (ADMIN) Tạm dừng phiên draft, tính toán và lưu `remaining_millis`.
- `POST /api/drafts/{id}/resume`: (ADMIN) Tiếp tục phiên draft, tính toán lại thời điểm hết hạn từ `remaining_millis`.
- `POST /api/drafts/{id}/cancel`: (ADMIN) Hủy bỏ phiên draft.
- `GET /api/teams/{id}/roster`: Lấy danh sách toàn bộ các thẻ cầu thủ đã pick thành công của đội.

## 4. Quality Gates
- **Tests**: 137/137 PASS
- **Ruff**: PASS | **Mypy strict**: PASS | **Import-linter**: PASS | **Pytest**: PASS
