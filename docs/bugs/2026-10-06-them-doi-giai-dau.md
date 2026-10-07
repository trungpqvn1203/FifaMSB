# Bug Fix: Nút thêm đội bị ẩn sau khi giải đấu có 2 đội

- **Ngày ghi nhận**: 2026-10-06
- **Triệu chứng**: Khi tạo đội tham gia giải đấu tại trang chi tiết giải (`/tournaments/:id`), người dùng chỉ thêm được tối đa 2 đội. Sau khi thêm Đội 2, nút "+ Thêm Đội" trong bảng danh sách đội biến mất khiến người dùng không thể tạo thêm Đội 3, 4, 8...
- **Nguyên nhân gốc (Root Cause)**:
  - Trong logic domain của Backend (`compute_tournament_status`), khi số đội `>= 2`, trạng thái giải đấu tự động chuyển từ `DRAFT` sang `READY` (đủ điều kiện tối thiểu để bắt đầu Draft). Backend vẫn cho phép thêm đội khi giải ở trạng thái `READY` (`if tournament.status not in ("DRAFT", "READY"): raise ...`).
  - Tuy nhiên tại Frontend (`frontend/src/pages/TournamentDetailPage.tsx`), điều kiện hiển thị nút "+ Thêm Đội" ở tiêu đề bảng "Danh Sách Đội Tham Gia" lại kiểm tra chặt:
    `{isAdmin && tournament.status === 'DRAFT' && (`
  - Khi có 2 đội, `tournament.status` trở thành `READY`, khiến điều kiện trên trả về `false` và nút "+ Thêm Đội" ở khu vực này bị ẩn.
- **Các file đã sửa**:
  - `frontend/src/pages/TournamentDetailPage.tsx`
- **Cách xử lý**:
  - Cập nhật điều kiện hiển thị nút "+ Thêm Đội" tại danh sách đội thành:
    `{isAdmin && (tournament.status === 'DRAFT' || tournament.status === 'READY') && !isDraftRunning && (`
  - Nút "+ Thêm Đội" sẽ tiếp tục hiển thị khi giải đấu ở trạng thái `READY` và chỉ ẩn đi khi phiên Draft thực sự bắt đầu (`RUNNING`).
- **Test xác nhận**:
  - Build frontend `npm run build` thành công (0 errors).
  - Backend unit test `test_tournament_rules.py` (20/20 PASS).
