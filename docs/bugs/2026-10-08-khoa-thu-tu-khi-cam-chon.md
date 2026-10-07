# Bug Fix & Business Invariant: Khóa thay đổi thứ tự và danh sách đội khi đang cấm chọn / giải đấu đang chạy

- **Ngày ghi nhận**: 2026-10-08
- **Triệu chứng & Rủi ro nghiệp vụ**:
  - Khi phiên cấm chọn cầu thủ (Draft Picking) hoặc cấm chiến thuật trận đấu (Match Ban Phase) đang diễn ra:
    - Nếu quản trị viên thay đổi thứ tự chọn quân (`draft_order`), thêm đội hoặc đảo thứ tự ngẫu nhiên, hệ thống sẽ gặp lỗi logic nghiêm trọng:
      1. **Trong phiên Draft**: Thuật toán tính lượt (`DraftOrderStrategy`) vận hành dựa trên danh sách đội đã sort theo `draft_order`. Nếu `draft_order` bị hoán đổi giữa chừng, lượt kế tiếp (`_advance_turn_under_lock`) sẽ bị nhảy cóc sang đội sai, một đội có thể bị pick 2 lần liên tiếp hoặc có đội bị bỏ qua, làm hỏng toàn bộ tính toàn vẹn của phiên Draft.
      2. **Trong trận đấu & Ban Phase**: Trận đấu đã được phân định `home_team` và `away_team`. Nếu thay đổi danh sách/thứ tự đội sẽ làm sai lệch phân quyền cấm trước/sau và lịch sử cấm chiến thuật.
  - Giao diện Admin (`AdminTeamsSection.tsx`) trước đó không kiểm tra trạng thái cấm chọn, vẫn cho phép kéo thả, bấm nút mũi tên hoặc bấm "Trộn Ngẫu Nhiên" / "Thêm Đội Mới", dẫn tới xung đột và trải nghiệm không nhất quán.
- **Nguyên nhân gốc (Root Cause)**:
  - Backend thiếu bước kiểm tra (guard) xem giải đấu có `DraftSession` đang hoạt động (`PICKING`, `PAUSED`, `WAITING` hoặc đã `COMPLETED`), hoặc có `Match` đang ở `BAN_PHASE`.
  - Frontend chưa truyền trạng thái khóa (`isOrderLocked`) xuống các component quản lý đội bóng để vô hiệu hóa Drag & Drop và ẩn các nút thao tác.
- **Các file đã sửa**:
  - `backend/app/common/errors.py`: Bổ sung exception domain `DraftOrderLocked(DomainError)` (HTTP 409).
  - `backend/app/tournament/service.py`:
    - Thêm helper bảo vệ `_assert_tournament_not_locked(tournament_id)`.
    - Kiểm tra và chặn trong `add_team`, `reorder_teams`, `randomize_draft_order`: ném `DraftOrderLocked` nếu giải đấu có draft session hoặc trận đấu đang trong giai đoạn cấm chọn.
  - `backend/tests/integration/test_tournament_api.py`: Bổ sung integration test `test_reorder_teams_locked_when_tournament_not_modifiable`.
  - `frontend/src/components/admin/AdminTeamsSection.tsx`:
    - Thêm prop `isLocked?: boolean`.
    - Khi `isLocked`: vô hiệu hóa Drag & Drop (`draggable={false}`), đổi icon tay cầm sang icon ổ khóa 🔒 với tooltip giải thích, disable các nút mũi tên Lên/Xuống, disable nút "Trộn Ngẫu Nhiên" và "Thêm Đội Mới", thêm badge `🔒 Thứ tự đã khóa (Đang cấm chọn)`.
  - `frontend/src/pages/AdminTournamentPage.tsx`: Tính toán `isOrderLocked` từ trạng thái giải đấu, draft (`PICKING`, `PAUSED`, `COMPLETED`), và ban phase của matches; truyền `isLocked` vào `AdminTeamsSection`.
  - `frontend/src/pages/TournamentDetailPage.tsx`: Tính toán `isOrderLocked`, vô hiệu hóa kéo thả trên các thẻ đội, ẩn nút Trộn Thứ Tự / Thêm Đội, và hiển thị thông báo khóa thứ tự rõ ràng cho ban tổ chức.
- **Cách xử lý**:
  - Áp dụng nguyên tắc **Bất biến miền nghiệp vụ (Domain Invariant)**: Khi đã bắt đầu bước cấm chọn, toàn bộ cấu trúc đội bóng và thứ tự bốc thăm trở thành **read-only / locked**.
  - Đồng bộ trạng thái khóa chặt chẽ từ Backend (ngăn chặn API mutations) đến Frontend (khóa tương tác người dùng và hiển thị chỉ dẫn trực quan).
- **Test xác nhận**:
  - Backend integration test PASS.
  - Typecheck `mypy --strict app`: PASS (0 errors).
  - Linter `ruff check`: PASS (0 errors).
  - Frontend bundle `npm run build`: PASS (0 errors).
