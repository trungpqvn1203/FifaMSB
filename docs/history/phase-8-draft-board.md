# Phase 8: Draft Board UI & WebSocket Hook

## 1. Mục tiêu & Phạm vi
- Triển khai giao diện phòng Draft trực tiếp (**Draft Board UI**) bám sát 100% nguyên mẫu `docs/ui/draft-board.html` và hệ Design Tokens trong `docs/ui/tokens.md`.
- Phát triển custom hook **`useDraftSocket`** kết nối native WebSocket với khả năng tự động bắt cookie, bù trừ lệch giờ server (`serverTimeOffset`), đếm ngược đồng hồ HUD chính xác, tự động reconnect với exponential backoff và phát hiện lệch phiên (`version gap`) để kích hoạt resync.
- Bổ sung endpoint backend `GET /api/tournaments/{tournament_id}/draft` lấy draft session hiện hành của giải đấu.
- Xây dựng hệ thống UI Components hoàn chỉnh:
  - `DraftHeader`: Header broadcast HUD, turn clock số to (`00:30`), trạng thái kết nối realtime, điều khiển Admin (Pause / Resume / Cancel).
  - `DraftTeamHeader`: Cột tiêu đề các đội tham gia kèm nhãn LIVE TURN, hiệu ứng phát sáng neon khi đang đến lượt, thanh tiến trình Salary Cap.
  - `DraftMatrix`: Lưới hiển thị các vòng pick (1..N rounds), ô thẻ đã pick (vị trí, mùa giải, tên, lương), ô đang chọn nhấp nháy neon ("SELECTING NOW..."), ô chờ lượt.
  - `WarRoomSidebar`: Sidebar mô phỏng 4 camera war room broadcast, hiển thị trạng thái LIVE FEED / DRAFTING, NEXT PICK, STANDBY.
  - `PlayerPoolDrawer`: Bảng chọn cầu thủ chiến thuật với chip lọc vị trí chi tiết, tìm kiếm không dấu, sắp xếp lương / OVR, kiểm tra trần lương và nút PICK PLAYER.

## 2. Danh sách file chính
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

## 3. Khái niệm Kỹ thuật sử dụng
1. **Server-Client Time Synchronization (`serverTimeOffset`)**: Khi WebSocket client nhận snapshot từ server mang theo timestamp ISO `serverTime`, client tính độ lệch `offset = serverTime - Date.now()`. Mọi phép tính đếm ngược từ `turnExpiresAt` được trừ đi khoảng bù `serverTimeOffset`, loại bỏ hoàn toàn hiện tượng lệch giây do sai lệch đồng hồ hệ thống giữa máy client và server.
2. **Version Gap Detection & Self-Healing Resync**: WebSocket hook theo dõi số `version` của draft. Nếu một gói tin đến mang `version > lastKnownVersion + 1` (cho thấy đã bỏ lỡ gói tin trung gian do mạng giật), hook lập tức kích hoạt invalidation trên TanStack Query để kéo lại toàn bộ state và danh sách picks mới nhất từ REST API.
3. **Optimistic Locking Guard on Client (`expectedVersion`)**: Thao tác gửi pick truyền kèm `expectedVersion`. Nhờ đó, nếu người dùng pick chậm trong tích tắc khi server vừa chuyển turn do timeout, request bị chặn an toàn với thông báo rõ ràng mà không gây sai lệch dữ liệu.
4. **Pure CSS Design Tokens Alignment**: Chuyển tải chính xác bảng màu Esports Broadcast HUD (`#0B0D0E`, `#13151B`, `#3DFF6B`, `#FF3B4E`, `#F5C518`) và typography (`Space Grotesk`, `JetBrains Mono`, `Inter`) vào Tailwind CSS và các UI components tái sử dụng cao.

## 4. Quality Gates
- **Build**: PASS
- **TypeScript**: 0 errors
- **Oxlint**: 0 errors
- **Pytest**: 157/157 PASS
