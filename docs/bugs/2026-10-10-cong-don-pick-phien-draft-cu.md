# Bug Fix: Phiên Draft kết thúc sớm do cộng dồn lượt pick từ phiên bị huỷ

- **Ngày ghi nhận**: 2026-10-10
- **Phase liên quan**: Phase 5 (Draft Engine), Phase 6 (Draft Realtime / WS)

---

### 1. Triệu chứng
- Khi giải đấu cấu hình `roster_size = 23` (23 lượt pick/đội), phiên draft mới chỉ diễn ra tới **Vòng 15** (Lượt pick thứ 30) thì hệ thống bất ngờ tự động kết thúc và chuyển trạng thái sang `COMPLETED` ("HOÀN THÀNH").
- Ở lượt thứ 30 (Vòng 15 của đội thứ hai), ô pick trên bảng ma trận vẫn để trống chưa hiển thị tên cầu thủ được pick dù database đã ghi nhận lượt pick.

---

### 2. Nguyên nhân gốc (Root Cause)
1. **Cộng dồn lượt pick phiên cũ (Backend)**:
   - Trước phiên draft hiện tại, giải đấu đã có 1 phiên draft từng bị huỷ (`CANCELLED`) sau khi mỗi đội pick được 8 cầu thủ.
   - Khi tính số lượng cầu thủ đội đã pick (`picked_count`), hàm `get_team_picks(session, team_id)` chỉ lọc theo `where(DraftPick.team_id == team_id)` mà không truyền `draft_session_id`.
   - Dẫn đến việc đếm gộp cả 8 lượt pick của phiên bị huỷ: $8 \text{ (cũ)} + 15 \text{ (mới)} = 23 \text{ cầu thủ}$.
   - Khi cả 2 đội đạt 15 lượt pick ở phiên mới, hệ thống tính ra cả 2 đội đều đã có 23 lượt pick $\ge roster\_size$ nên `LinearOrder.next_turn` đánh dấu `is_completed = True`.
2. **Không dọn dẹp phiên bị huỷ (Backend)**:
   - Khi gọi `cancel_draft`, hệ thống chỉ đổi trạng thái phiên sang `CANCELLED` mà không xoá các `DraftPick` đã tạo trong phiên đó và không reset `teams.budget_used`.
3. **Thiếu xử lý sự kiện DRAFT_COMPLETED trên Frontend**:
   - Ở lượt pick thứ 30, do phiên kết thúc đồng thời, backend broadcast sự kiện `DRAFT_COMPLETED`.
   - Hook `useDraftSocket.ts` chỉ bắt `eventType === 'PICK_MADE'` để trigger `onPickMade` (refetch queries `draft-picks`). Do đó khi phiên hoàn thành, lượt pick cuối cùng chưa được refetch để render vào ô ma trận V15.

---

### 3. Các file đã sửa
- [`backend/app/draft/repository.py`](file:///d:/VideCode/WebFifa/backend/app/draft/repository.py):
  - Cập nhật `get_team_picks(session, team_id, draft_session_id=None)` lọc theo `draft_session_id` nếu có, hoặc loại trừ phiên `CANCELLED`.
  - Thêm `delete_draft_picks_by_session(session, draft_session_id)` để xoá các pick khi huỷ phiên.
- [`backend/app/draft/service.py`](file:///d:/VideCode/WebFifa/backend/app/draft/service.py):
  - `pick_card`, `_advance_turn_under_lock`, `_apply_timeout_under_lock` đều truyền `draft_session_id=draft.id` vào `get_team_picks`.
  - `cancel_draft`: xoá sạch các `DraftPick` của phiên bị huỷ và reset `teams.budget_used = 0`.
- [`backend/app/match/repository.py`](file:///d:/VideCode/WebFifa/backend/app/match/repository.py):
  - Thêm điều kiện `DraftSession.status != 'CANCELLED'` trong `is_card_on_team_roster`.
- [`frontend/src/types/domain.ts`](file:///d:/VideCode/WebFifa/frontend/src/types/domain.ts):
  - Bổ sung `TIMEOUT_AUTO_PICK` và `TURN_SKIPPED` vào union type `DraftSocketEvent.eventType`.
- [`frontend/src/hooks/useDraftSocket.ts`](file:///d:/VideCode/WebFifa/frontend/src/hooks/useDraftSocket.ts):
  - Kích hoạt `onPickMade` cho cả các sự kiện `TIMEOUT_AUTO_PICK`, `DRAFT_COMPLETED`, hoặc bất kỳ sự kiện nào có `payload.pickedPlayer`.
- [`backend/tests/integration/test_draft_api.py`](file:///d:/VideCode/WebFifa/backend/tests/integration/test_draft_api.py):
  - Thêm integration test `test_cancelled_draft_does_not_accumulate_picks_in_new_draft`.

---

### 4. Cách fix
- Khi tính toán số lượng lượt pick cho 1 phiên draft, chỉ đếm các lượt pick thuộc phiên đó (`draft_session_id == draft.id`).
- Khi huỷ phiên draft, xoá toàn bộ lượt pick mồ côi của phiên đó và reset quỹ lương của các đội về 0.
- Dọn dẹp 16 lượt pick cũ của phiên bị huỷ trong database hiện tại, và khôi phục phiên draft hiện tại về trạng thái `PICKING` tại Vòng 16 (Lượt 31).
- Frontend đồng bộ danh sách pick ngay khi nhận sự kiện `DRAFT_COMPLETED` hoặc `TIMEOUT_AUTO_PICK`.

---

### 5. Test xác nhận
- Unit tests: 104 passed.
- Integration test mới `test_cancelled_draft_does_not_accumulate_picks_in_new_draft` passed (10.73s).
- Quality gates: `ruff check` (pass), `ruff format` (pass), `mypy --strict` (pass), `lint-imports` (pass).
- Frontend production bundle build thành công không lỗi TypeScript.
