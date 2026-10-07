# Phase 6: Draft Timer Background Task & WebSocket Realtime

## 1. Mục tiêu & Phạm vi
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

## 2. Danh sách file chính
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

## 3. API & WebSocket Specifications
- `WS /ws/drafts/{id}`:
  - **Handshake**: Cookie `session_token` + header `Origin`.
  - **Connect**: Nhận ngay message JSON `INITIAL_SNAPSHOT` có `draftId`, `version`, `serverTime`, `teams`, `picks`.
  - **Heartbeat**: Gửi text `ping` -> nhận text `pong`.
  - **Broadcast Events**: `PICK_MADE`, `TIMEOUT_AUTO_PICK`, `DRAFT_PAUSED`, `DRAFT_RESUMED`, `DRAFT_COMPLETED`.

## 4. Quality Gates
- **Tests**: 156/156 PASS
- **Ruff**: PASS | **Mypy strict**: PASS | **Import-linter**: PASS | **Pytest**: PASS
