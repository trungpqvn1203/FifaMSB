# Bug Fix: Đồng bộ và chuẩn hóa toàn diện Logic Cấm Cầu Thủ Trong Trận Đấu (Match Ban Phase)

- **Ngày ghi nhận**: 2026-10-11
- **Phase liên quan**: Phase 8 (Matches & Bans), Phase 7/UI (MatchBanPage, TargetRosterPanel, TacticalActionDock)

---

### 1. Triệu chứng
1. **Luật thi đấu bị fallback về mặc định**: Khi giải đấu cấu hình thời gian cấm 120s hoặc số lượt cấm khác 5, trận đấu luôn chỉ đếm lùi 60s và bắt buộc cấm đúng 5 cầu thủ.
2. **Biến mất danh sách ban trên giao diện khi WebSocket broadcast**: Khi đội vừa chọn cấm cầu thủ hoặc có sự kiện socket từ phòng trận đấu, danh sách cấm của đội bất ngờ biến mất về rỗng `[]` trên màn hình của chính đội đó.
3. **Admin truy cập phòng cấm chọn bị lỗi 422 `NO_TEAM_ASSIGNED`**: Khi tài khoản Admin (không thuộc đội nào) vào xem trận đấu, giao diện tự động gán Admin là Home Team và hiển thị dock bấm cấm; khi Admin bấm cấm thì backend từ chối với mã lỗi 422.
4. **Lỗi hiển thị thanh tiến độ `NaN%` và treo dock khi `ban_count = 0`**: Khi giải đấu cấu hình không cấm cầu thủ nào (`ban_count = 0`), thanh tiến độ thanh cấm tính `(0 / 0) * 100` ra `NaN%` và không thể bấm xác nhận khóa ban.
5. **Cầu thủ giả lập (Mock Roster) xuất hiện trong trận đấu thật**: Nếu danh sách cầu thủ của đội đối thủ chưa tải xong hoặc rỗng, giao diện tự rơi về danh sách mẫu (`SAMPLE_TARGET_ROSTER`) có ID giả dạng `tps-1`, khi bấm cấm hệ thống báo lỗi 422 `PLAYER_NOT_IN_ROSTER`.

---

### 2. Nguyên nhân gốc (Root Cause)
1. **Không tương thích format JSONB snake_case / camelCase (Backend)**:
   - `TournamentRules.to_dict()` lưu trữ cấu hình luật giải đấu dưới dạng snake_case (`ban_count`, `ban_time_seconds`, `ban_target`, `ban_order`).
   - `MatchService` ở backend chỉ đọc camelCase (`banCount`, `banTimeSeconds`, `banTarget`, `banOrder`) mà không có fallback sang snake_case, dẫn đến tất cả giải đấu đều fallback về giá trị mặc định (5 lượt cấm, 60s, OPPONENT_ROSTER, SIMULTANEOUS).
2. **Masking dữ liệu ban trên WebSocket đè mất state riêng của đội (Frontend)**:
   - Theo BR-M04, trong giai đoạn `BAN_PHASE` thể thức đồng thời (`SIMULTANEOUS`), WebSocket broadcast công khai che giấu lượt cấm của cả hai đội (`bans: []`).
   - Trên `MatchBanPage.tsx`, logic state chọn `socketMatch || fetchedMatch`, khiến payload broadcast rỗng đè mất `fetchedMatch.bans` (dữ liệu ban riêng tư hợp lệ mà API HTTP trả về cho đội).
3. **Logic nhận diện đội trưởng / khán giả chưa chặt chẽ (Frontend)**:
   - `MatchBanPage.tsx` chỉ kiểm tra `const isAwayTeam = userTeamId === match.awayTeamId; const isHomeTeam = !isAwayTeam;`.
   - Với tài khoản Admin (`userTeamId === null`), hệ thống gán `isHomeTeam = true`, cho phép Admin tương tác vào slot cấm của Home Team và gọi API submit ban vốn yêu cầu token gắn với đội.
4. **Chia cho 0 khi tính tỷ lệ tiến độ cấm**:
   - `TargetRosterPanel.tsx` tính `(count / maxBans) * 100` mà không kiểm tra `maxBans === 0`.
5. **Client có thể gửi sai `target` cấm**:
   - Backend chấp nhận trường `target` do client gửi lên thay vì ép buộc chặt chẽ theo `ban_target` của giải đấu (`rules_snapshot`).
6. **Thiếu eager loading trên danh sách trận đấu làm crash 500 (`MissingGreenlet`)**:
   - `list_matches_for_tournament` ở repository chỉ eager-load `home_team` và `away_team` mà không load `Match.bans` và các relationship con.
   - Khi serializer gọi `build_match_view_dict`, việc truy cập `match.bans` gây ra exception `MissingGreenlet` trong async SQLAlchemy.
   - Dẫn đến endpoint `GET /api/tournaments/{tournament_id}/matches` trả về 500, khiến giao diện của các đội tuyển ở trang giải đấu không thể tải danh sách trận và hiển thị "Chưa có trận đấu nào được lên lịch" ("0 Trận").
7. **Thiếu broadcast WebSocket khi submit/delete gặp timer hết hạn**:
   - Khi timer vừa hết hạn mà đội gửi ban, backend trả lỗi `BAN_TIMER_EXPIRED` nhưng chưa phát sinh sự kiện `BANS_LOCKED` cho toàn phòng đấu.

---

### 3. Các file đã sửa
- [`backend/app/match/repository.py`](file:///d:/VideCode/WebFifa/backend/app/match/repository.py):
  - Bổ sung `selectinload` đầy đủ cho `Match.bans` cùng các quan hệ lồng nhau (`player_season.player`, `player_season.season`, `banning_team`, `target_team`) trong `list_matches_for_tournament`, sửa triệt để lỗi 500 `MissingGreenlet`.
- [`backend/app/match/service.py`](file:///d:/VideCode/WebFifa/backend/app/match/service.py):
  - Hỗ trợ cả snake_case và camelCase khi đọc `rules_snapshot` (`banTimeSeconds` / `ban_time_seconds`, `banCount` / `ban_count`, `banTarget` / `ban_target`, `banOrder` / `ban_order`).
  - Ép `resolved_target` theo rule giải đấu, loại bỏ rủi ro client bypass target.
  - Tự động broadcast sự kiện WebSocket `BANS_LOCKED` khi `submit_ban` hoặc `delete_ban` gặp timer đã hết hạn.
- [`frontend/src/pages/MatchBanPage.tsx`](file:///d:/VideCode/WebFifa/frontend/src/pages/MatchBanPage.tsx):
  - Hợp nhất state thông minh: Giữ lại `fetchedMatch.bans` của đội nếu `socketMatch.bans` bị làm rỗng trong giai đoạn `BAN_PHASE`.
  - Hỗ trợ chế độ giám sát `isSupervisor` cho Admin (`isAdmin && !userTeamId`), ngăn ngừa giả mạo Home Team.
  - Đọc `maxBans` linh hoạt từ cả `banCount`, `ban_count` và `banQuota`.
  - Ngăn chặn fallback sang mock data `SAMPLE_TARGET_ROSTER` với các ID giả dạng `tps-*` khi ở chế độ `live`.
- [`frontend/src/pages/TournamentDetailPage.tsx`](file:///d:/VideCode/WebFifa/frontend/src/pages/TournamentDetailPage.tsx):
  - Thêm xử lý `matchesError` hiển thị thông báo kết nối lại rõ ràng thay vì rơi vào trạng thái rỗng "Chưa có trận đấu".
- [`frontend/src/components/match/MatchScoreboard.tsx`](file:///d:/VideCode/WebFifa/frontend/src/components/match/MatchScoreboard.tsx):
  - Hỗ trợ snake_case `ban_count` và `ban_order`, đảm bảo hiển thị đúng số lượt cấm và cơ chế cấm theo cấu hình giải.
- [`frontend/src/components/match/TargetRosterPanel.tsx`](file:///d:/VideCode/WebFifa/frontend/src/components/match/TargetRosterPanel.tsx):
  - Xử lý trường hợp `maxBans === 0` để tránh lỗi CSS `NaN%`.
- [`frontend/src/components/match/TacticalActionDock.tsx`](file:///d:/VideCode/WebFifa/frontend/src/components/match/TacticalActionDock.tsx):
  - Thêm prop `isSupervisor`: Hiển thị huy hiệu giám sát viên/khán giả thay vì các nút khóa cấm chọn của đội tuyển.
  - Hỗ trợ cho phép xác nhận ngay khi giải cấu hình `maxBans === 0`.
- [`backend/tests/integration/test_match_api.py`](file:///d:/VideCode/WebFifa/backend/tests/integration/test_match_api.py):
  - Thêm integration test `test_snake_case_rules_parsed_correctly` kiểm tra thời gian hết hạn và số lượt cấm chuẩn xác khi `rules_snapshot` là snake_case.

---

### 4. Triển khai & Kiểm thử
- **Quality Gates**:
  - `uv run ruff check app/ tests/` (All checks passed)
  - `uv run ruff format --check app/ tests/` (78 files already formatted)
  - `uv run mypy app/` (Success: no issues found in 52 source files)
  - `uv run lint-imports` (Contracts: 4 kept, 0 broken)
  - Unit & Integration Tests: `111 passed`.
  - Endpoint `GET /api/tournaments/{id}/matches` trả về HTTP 200 kèm danh sách trận đấu đầy đủ.
  - Frontend: `npm run build` (Build production bundle thành công, 0 lỗi TypeScript).
- **Deploy Container**:
  - Đã sync source code vào container `webfifa_backend` và khởi động lại.
  - Đã build và sync `dist/` vào container `webfifa_frontend` (Nginx) và khởi động lại.
  - Các container `webfifa_backend`, `webfifa_frontend`, `webfifa_postgres` hoạt động ổn định.
