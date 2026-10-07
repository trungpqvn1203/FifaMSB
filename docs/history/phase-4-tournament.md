# Phase 4: Tournaments, Rules (JSONB) & Teams Management

## 1. Mục tiêu & Phạm vi
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

## 2. Danh sách file chính
- `backend/app/common/errors.py`: Bổ sung các lỗi `TournamentNotFound`, `TournamentNotReady`, `DraftOrderConflict`, `TeamNotFound`.
- `backend/app/tournament/domain.py`: SQLAlchemy models `Tournament`, `Team` và Pydantic domain model `TournamentRules`, hàm chuyển trạng thái `compute_tournament_status`.
- `backend/app/tournament/repository.py`: Truy vấn giải đấu, đội thi đấu với eager loading `selectinload(Tournament.teams)` để tránh lỗi lazy load trong môi trường async.
- `backend/app/tournament/service.py`: Nghiệp vụ giải đấu, thêm đội, kiểm tra xung đột draft_order và commit tường minh.
- `backend/app/tournament/api.py`: Schemas và Routers cho Tournaments (`/api/tournaments`) và Teams (`/api/teams`).
- `backend/tests/unit/test_tournament_rules.py`: 20 unit test kiểm tra toàn bộ validation luật giải đấu và state transition.
- `backend/tests/integration/test_tournament_api.py`: 16 integration test trên PostgreSQL thực tế (testcontainers).

## 3. API Endpoints
- `POST /api/tournaments`: (ADMIN) Tạo giải đấu mới với các luật mặc định hoặc tùy chỉnh.
- `GET /api/tournaments`: Lấy danh sách giải đấu (kèm số lượng đội).
- `GET /api/tournaments/{id}`: Xem chi tiết giải đấu (kèm danh sách đội đã tham gia).
- `POST /api/tournaments/{id}/complete`: (ADMIN) Đánh dấu giải đấu đã hoàn thành.
- `POST /api/tournaments/{id}/teams`: (ADMIN) Thêm đội vào giải đấu kèm `draft_order`. Tự động chuyển `DRAFT -> READY` khi đủ `>= 2` đội.
- `GET /api/tournaments/{id}/teams`: Lấy danh sách đội theo thứ tự draft_order.
- `POST /api/tournaments/{id}/teams/reorder`: (ADMIN) Sắp xếp lại thứ tự Draft theo mảng `teamIds` mong muốn (dùng 2-phase atomic update tránh xung đột unique key).
- `POST /api/tournaments/{id}/teams/randomize`: (ADMIN) Đảo ngẫu nhiên thứ tự Draft của toàn bộ đội trong giải.
- `GET /api/teams/{id}/roster`: Lấy danh sách cầu thủ đã pick của đội (stub rỗng ở Phase 4, Phase 5 đã liên kết DraftPick).

## 4. Quality Gates
- **Tests**: 112/112 PASS (bổ sung test `test_randomize_teams_order`, `test_reorder_teams_locked_when_tournament_not_modifiable`)
- **Ruff**: PASS | **Mypy strict**: PASS | **Import-linter**: PASS | **Pytest**: PASS
