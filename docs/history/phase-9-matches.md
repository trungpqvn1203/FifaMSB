# Phase 9: Matches & Tactical Bans (Backend)

## 1. Mục tiêu & Phạm vi
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

## 2. Danh sách file chính
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

## 3. Khái niệm Python sử dụng
1. **SELECT FOR UPDATE với Quan hệ Outer Join (`selectinload` vs `joinedload`)**: Khi thực hiện khóa bi quan hàng dữ liệu (`SELECT ... FOR UPDATE`), PostgreSQL không cho phép áp dụng khóa lên nhánh nullable của một `LEFT OUTER JOIN` (vốn được sinh ra bởi `joinedload`). Giải pháp là sử dụng `selectinload` để tải các mối quan hệ (teams, bans, player_season) qua các câu lệnh SELECT độc lập sau đó, giữ cho câu lệnh khóa ban đầu hoàn toàn đơn giản và an toàn tuyệt đối.
2. **Optional FastAPI Dependency Injection (`get_optional_current_user`)**: Khác với `get_current_user` vốn raise ngay `Unauthorized (401)` khi không có session cookie, dependency tùy chọn đọc request cookie/header và trả về `User | None`. Nhờ đó, endpoint GET chi tiết trận đấu cho phép cả khán giả chưa đăng nhập lẫn người chơi trong cuộc truy cập, đồng thời định tuyến chính xác dữ liệu mật cần lọc qua `viewer_team_id`.
3. **Pydantic Model Validator sau Khởi tạo (`@model_validator(mode='after')`)**: Sử dụng decorator `@model_validator(mode="after")` trong Pydantic v2 để thẩm định các ràng buộc logic liên quan đến nhiều trường cùng lúc (ví dụ kiểm tra `home_team_id != away_team_id`). Lỗi phát sinh trong validator tự động được FastAPI chuyển thành mã lỗi HTTP 422 Unprocessable Entity chuẩn RFC.
4. **Phản hồi Lọc Bảo mật Động (Role-Based Dynamic View Projection)**: Thay vì trả về toàn bộ dữ liệu thô từ database, service sử dụng hàm thuần Python `build_match_view_dict` để chiếu (project) dữ liệu: trong chế độ cấm bí mật (`SIMULTANEOUS`), mỗi đội chỉ được nhìn thấy thẻ của mình và con số đếm thẻ của đối phương. Chỉ khi cả hai xác nhận xong (`BANS_LOCKED`), phép chiếu mới mở khóa toàn bộ danh sách thẻ cho tất cả các bên.

## 4. Quality Gates
- **Tests**: 169/169 PASS (94 unit, 75 integration)
- **Ruff**: PASS | **Mypy strict**: PASS | **Import-linter**: PASS | **Pytest**: PASS
