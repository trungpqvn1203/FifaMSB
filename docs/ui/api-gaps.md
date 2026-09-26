# FC Online Draft System — API Gaps & UI Data Requirements Analysis

Tài liệu này đối chiếu chi tiết giữa **nguyên mẫu giao diện người dùng** (3 màn hình HTML tại `docs/ui/`) và **đặc tả kiến trúc backend** tại `docs/design.md`.

Mục đích:
1. Xác định toàn bộ dữ liệu (data fields) và hành động (actions) mà mỗi màn hình cần.
2. Đối chiếu với API endpoint và schema hiện có trong `design.md` xem đã đáp ứng đủ hay chưa.
3. Liệt kê mọi điểm sai lệch (mismatches) hoặc khoảng trống (gaps).
4. Đề xuất các giải pháp thay đổi nhỏ nhất (minimal schema/API changes) để bổ sung vào `design.md` mà không làm thay đổi các quy tắc nghiệp vụ cốt lõi hay làm phức tạp hóa hệ thống.

---

## 1. Màn hình 1: Draft Board (`docs/ui/draft-board.html`)

Màn hình phòng Draft chính thời gian thực phục vụ các đội tham gia và khán giả theo dõi.

### 1.1 Bảng đối chiếu Dữ liệu & Thao tác

| Vùng giao diện | Dữ liệu / Thao tác cần trên UI | Endpoint / Field trong `design.md` | Đánh giá | Ghi chú & Mismatch |
| :--- | :--- | :--- | :--- | :--- |
| **Top Global Header** | Tên giải đấu (`FC Pro 2026`) | `GET /api/tournaments/{id}` &rarr; `name` | Có sẵn | Khớp |
| | Mã giải / Room Code (`DRAFT ROOM #01`) | `GET /api/tournaments/{id}` &rarr; `id` (UUID) | Có sẵn | UI hiển thị dạng label rút gọn, có thể dùng UUID hoặc thêm `code` |
| | Trạng thái giải (`WAITING`, `PICKING`, `PAUSED`, `COMPLETED`) | `DraftState.status` qua WebSocket | Có sẵn | Khớp hoàn toàn |
| **Central Turn Clock (HUD)** | Thời gian đếm ngược (mm:ss) | `DraftState.turnStartedAt`, `turnExpiresAt`, `serverTime`, `remainingMillis` | Có sẵn | Khớp. Client tính hiệu số giữa `turnExpiresAt` và `serverTime` |
| | Thông tin lượt hiện tại (`Round 5`, `Pick 52`) | `DraftState.currentRound`, `DraftState.currentTurn` | Có sẵn | Khớp |
| | Đội đang đến lượt pick | `DraftState.currentTeamId` | Có sẵn | Khớp |
| | Đội On-Deck (`ON DECK · PICK 53 - VAL`) | Không có trường `onDeckTeamId` trong `DraftState` | **GAP** | Client phải tự tính toán hoặc backend nên trả về `onDeckTeamId` |
| **Team Columns Header** | Danh sách các đội tham gia (1..N) | `DraftState.teams[]` | Có sẵn | Khớp (`id, name, draftOrder, budgetUsed, budgetRemaining, pickedCount`) |
| | Mã viết tắt đội (`VFC`, `TTN`, `AMT`, `VEX`) | Model `Team` chỉ có `name` | **GAP** | `Team` thiếu trường `short_name` (ví dụ 3-4 ký tự) |
| | Logo / Avatar đội bóng | Model `Team` chưa có `logo_url` | **GAP** | UI hiển thị logo/icon riêng cho từng đội |
| | Ngân sách còn lại & đã dùng | `DraftState.teams[].budgetUsed`, `budgetRemaining` | Có sẵn | Khớp hoàn toàn |
| | Số lượng thẻ đã pick (`5/24`) | `DraftState.teams[].pickedCount` | Có sẵn | Khớp hoàn toàn |
| **Drafted Picks Grid** | 24 slot thẻ đã pick của mỗi team | `GET /api/drafts/{id}/picks` | **GAP một phần** | Cần làm rõ: schema của `DraftPick` trong endpoint phải join đủ `name, position, rating, salaryAtPick, seasonCode, seasonBadgeUrl` |
| | Cập nhật thẻ vừa pick theo thời gian thực | `DraftState.pickedPlayer` qua WebSocket | Có sẵn | WebSocket snapshot chứa thông tin thẻ vừa pick |
| **Player Pool Drawer** | Tìm kiếm cầu thủ theo tên (không dấu) | `GET /api/player-seasons?search=...` | Có sẵn | Hỗ trợ pg_trgm + unaccent |
| | Lọc theo mùa giải | `GET /api/player-seasons?seasonId=...` | Có sẵn | Khớp |
| | Lọc theo nhóm vị trí (`FW`, `MF`, `DF`, `GK`) | `GET /api/player-seasons?position=...` | **GAP** | Backend chỉ nhận vị trí cụ thể (`position=ST`), chưa hỗ trợ lọc theo nhóm (`positionGroup=FW`) |
| | Thông tin thẻ trong bảng: Vị trí, Mùa, Tên, Rating, Lương | `GET /api/player-seasons` schema | Có sẵn | Khớp (`position, rating, salary, imageUrl, player, season`) |
| | Thông tin Quốc gia & CLB (`Norway · Man City`) | Entity `Player` chỉ có `id, name, externalPlayerId` | **GAP phụ** | Không bắt buộc cho logic draft, nhưng UI có chỗ hiển thị |
| **Thao tác Pick** | Nút "CONFIRM DRAFT PICK" | `POST /api/drafts/{id}/picks` (`playerSeasonId, expectedVersion`) | Có sẵn | Khớp hoàn toàn với quy tắc xác thực qua cookie & optimistic lock |
| **Webcam Stream Grid** | 4 ô live webcam feed của các đội | Không có trong `design.md` | **GAP phụ** | Có thể lưu `stream_url` nullable trên `Team` hoặc coi là tính năng bổ trợ |

---

## 2. Màn hình 2: Admin Tournament Management (`docs/ui/admin-tournament.html`)

Màn hình cấu hình giải đấu, cài đặt luật draft, quản lý đội và nhập dữ liệu cầu thủ.

### 2.1 Bảng đối chiếu Dữ liệu & Thao tác

| Vùng giao diện | Dữ liệu / Thao tác cần trên UI | Endpoint / Field trong `design.md` | Đánh giá | Ghi chú & Mismatch |
| :--- | :--- | :--- | :--- | :--- |
| **Thông tin cơ bản** | Tên giải đấu | `Tournament.name` | Có sẵn | Khớp |
| | Mã định danh giải (`Tournament Code`: `s2-2026-draft`) | Entity `Tournament` chỉ có `id` (UUID) và `name` | **GAP nhỏ** | Nên có `code` hoặc `slug` ngắn gọn để nhận diện |
| | Trạng thái giải đấu | `Tournament.status` (`DRAFT`, `READY`, `RUNNING`, `COMPLETED`, `CANCELLED`) | Có sẵn | Khớp hoàn toàn |
| **Cấu hình Draft Rules** | Kích thước đội hình (`rosterSize`: 24) | `rules.rosterSize` | Có sẵn | Khớp |
| | Trần ngân sách lương (`budget`: 305) | `rules.budget` | Có sẵn | Khớp |
| | Thời gian mỗi lượt pick (`pickTimeSeconds`: 30) | `rules.pickTimeSeconds` | Có sẵn | Khớp |
| | Quy tắc trùng cầu thủ (`uniqueBy`: `PLAYER` \| `CARD`) | `rules.uniqueBy` | Có sẵn | Khớp |
| | Quy tắc xử lý hết giờ (`timeoutPolicy`: `AUTO_PICK_CHEAPEST` \| `SKIP_TURN`) | `rules.timeoutPolicy` | Có sẵn | Khớp |
| | Danh sách mùa giải hợp lệ | `rules.allowedSeasonIds` | Có sẵn | Khớp |
| | Kiểu thứ tự Draft (`Linear` vs `Snake`) | `DraftOrderStrategy` có trong spec nhưng chưa có trong `TournamentRules` | **GAP** | `TournamentRules` cần thêm trường `draftOrderStrategy` (`LINEAR` \| `SNAKE`) |
| **Cấu hình Ban Rules** | Số lượng cầu thủ bị cấm (`banCount`: 5) | `rules.banCount` | Có sẵn | Khớp |
| | Thời gian giai đoạn cấm (`banTimeSeconds`: 60) | `rules.banTimeSeconds` | Có sẵn | Khớp |
| | Mục tiêu cấm (`banTarget`: `OPPONENT_ROSTER` \| `OWN_ROSTER`) | `rules.banTarget` | Có sẵn | Khớp |
| | Cơ chế cấm (`banOrder`: `SIMULTANEOUS` \| `ALTERNATING`) | `rules.banOrder` | Có sẵn | Khớp |
| **Quản lý Franchise / Đội** | Thêm đội mới vào giải đấu | `POST /api/tournaments/{id}/teams` (`name, draftOrder`) | Có sẵn | Khớp |
| | Danh sách đội trong giải | `GET /api/tournaments/{id}/teams` | Có sẵn | Khớp |
| | Mã viết tắt đội (`Franchise Tag`: `AMT`, `VEX`) | Model `Team` chưa có `short_name` | **GAP** | Trùng lặp với gap ở màn hình Draft Board |
| | Trạng thái liên kết User (`LINKED` vs `UNLINKED`) | `GET /api/tournaments/{id}/teams` chưa trả về user link | **GAP** | Cần trả về `assignedUser: {id, username} | null` |
| | Xóa đội khi giải chưa bắt đầu | Chưa có endpoint `DELETE /api/tournaments/{id}/teams/{teamId}` | **GAP** | Cần endpoint xóa team ở trạng thái `DRAFT` / `READY` |
| **Import CSV & Verification** | Tải lên file CSV cầu thủ | `POST /api/admin/players/import` (multipart CSV) | Có sẵn | Khớp |
| | Thống kê kết quả import (Total, Valid, Warnings, Errors, Log) | Import response trả về `{rowsRead, inserted, updated, skipped, errors}` | Có sẵn | Khớp hoàn hảo với Report Card |
| | Hiệu chỉnh điểm lương đơn lẻ | `PATCH /api/admin/player-seasons/{id}` (`salary`) | Có sẵn | Khớp hoàn toàn (khóa khi draft đang chạy) |
| **Khởi chạy Draft** | Nút "Publish & Launch Draft Room" | `POST /api/tournaments/{id}/draft/start` | Có sẵn | Khớp (yêu cầu trạng thái READY, >= 2 teams, reset budget = 0) |

---

## 3. Màn hình 3: Pre-Match Tactical Ban Phase (`docs/ui/match-bans.html`)

Màn hình cấm cầu thủ chiến thuật giữa 2 đội bóng trước giờ thi đấu.

### 3.1 Bảng đối chiếu Dữ liệu & Thao tác

| Vùng giao diện | Dữ liệu / Thao tác cần trên UI | Endpoint / Field trong `design.md` | Đánh giá | Ghi chú & Mismatch |
| :--- | :--- | :--- | :--- | :--- |
| **Match Banner & Match Info** | Tiêu đề trận (`MATCH #04 · BEST OF 3 · FINALS`) | Model `Match` chỉ có `homeTeamId, awayTeamId, scheduledAt, status` | **GAP nhỏ** | `Match` thiếu nhãn tiêu đề trận (`title` hoặc `matchNumber`) |
| | Thông tin 2 đội bóng (Tên, Mã viết tắt, HLV, Record) | `homeTeamId`, `awayTeamId` | Có sẵn một phần | Cần join thông tin cơ bản của 2 đội khi gọi `GET /api/matches/{id}` |
| | Trạng thái cấm (`SCHEDULED`, `BAN_PHASE`, `BANS_LOCKED`, `COMPLETED`) | `Match.status` | Có sẵn | Khớp hoàn toàn |
| **Central Ban Timer HUD** | Thời gian đếm ngược giai đoạn cấm | `banStartedAt`, `banExpiresAt` | Có sẵn | Khớp hoàn toàn |
| | Trạng thái giai đoạn (`BLIND TARGET SELECTION`, `MUTUAL LOCK-IN PENDING`, `REVEALED`) | Dẫn xuất từ `status` và cờ `homeConfirmed`, `awayConfirmed` | Có sẵn | Khớp |
| | Trạng thái cấm của đối thủ (`Drafting...` vs `Locked`) | WebSocket `/ws/matches/{id}` | Có sẵn | Chế độ SIMULTANEOUS ẩn danh sách thẻ, chỉ hiện số lượng / trạng thái |
| **Tactical Rosters (2 Cột 24 cầu thủ)** | Danh sách 24 cầu thủ đội nhà (Friendly Roster) | `GET /api/teams/{homeTeamId}/roster` | Có sẵn | Khớp |
| | Danh sách 24 cầu thủ đội khách (Opponent Roster) | `GET /api/teams/{awayTeamId}/roster` | Có sẵn | Khớp |
| | Thông tin chi tiết thẻ: Vị trí, Mùa, Tên, OVR, Lương | Roster schema từ `DraftPick` | Có sẵn | Khớp |
| **Thao tác Ban & Thanh Dock** | Click chọn cấm cầu thủ (`+ BAN`) | `POST /api/matches/{id}/bans` (`playerSeasonId`) | Có sẵn | Khớp |
| | Hoàn tác / Hủy cấm cầu thủ | `DELETE /api/matches/{id}/bans/{banId}` | Có sẵn | Khớp (hoặc bổ sung hủy trực tiếp theo `playerSeasonId`) |
| | Thanh tiến trình quota cấm (`3/5 Bans`) | `rulesSnapshot.banCount` và danh sách bans của team | Có sẵn | Khớp |
| | Nút khóa cấm ("LOCK BANS & READY") | `POST /api/matches/{id}/bans/confirm` | Có sẵn | Khớp hoàn toàn |
| | Xem kết quả cấm sau khi khóa | `GET /api/matches/{id}` khi status `BANS_LOCKED` | Có sẵn | Khớp (toàn bộ bans được công khai sau khi 2 bên confirm hoặc timeout) |

---

## 4. Tổng hợp các Gaps & Đề xuất giải pháp nhỏ nhất (Smallest Changes)

Các đề xuất dưới đây tuân thủ nguyên tắc: **Boring Python, tối giản, chỉ bổ sung các trường dữ liệu và query params thực sự cần thiết**, không thay đổi kiến trúc hay các luật nghiệp vụ cốt lõi:

### 4.1 Gap 1: Nhận diện thương hiệu đội bóng (`short_name` & `logo_url`)
- **Vấn đề**: Cả 3 màn hình đều cần mã viết tắt 3-4 ký tự (ví dụ: `VFC`, `TTN`, `AMT`) để hiển thị trên bảng HUD, avatar, tag và webcam. Hiện entity `Team` chỉ có `name`.
- **Đề xuất thay đổi nhỏ nhất**:
  - Thêm cột `short_name: VARCHAR(10) NULL` vào bảng `teams` (và model SQLAlchemy `Team`).
  - Thêm cột `logo_url: VARCHAR(500) NULL` vào bảng `teams`.
  - Cập nhật payload `POST /api/tournaments/{id}/teams` nhận thêm `short_name` (optional, nếu rỗng có thể tự sinh từ 3 ký tự đầu của `name`).

### 4.2 Gap 2: Đội chờ lượt kế tiếp (`onDeckTeamId`) trong WebSocket `DraftState`
- **Vấn đề**: Màn hình Draft Board hiển thị thông tin "ON DECK · PICK 53 (VAL)". Nếu frontend tự tính thì cần tái hiện lại toàn bộ thuật toán vòng tròn (turn wrap-around & skip full rosters) trên client.
- **Đề xuất thay đổi nhỏ nhất**:
  - Bổ sung trường `onDeckTeamId: UUID | None = None` vào Pydantic schema `DraftState` (và payload broadcast WebSocket). Service tính toán `onDeckTeamId` cùng lúc với việc xác định `currentTeamId`.

### 4.3 Gap 3: Lọc cầu thủ theo nhóm vị trí (`positionGroup`)
- **Vấn đề**: Màn hình Draft Board có 4 chip lọc nhanh: `FW`, `MF`, `DF`, `GK`. Hiện tại backend chỉ nhận query param `position=` cho vị trí cụ thể (ví dụ: `position=ST`).
- **Đề xuất thay đổi nhỏ nhất**:
  - Thêm query parameter tùy chọn `group: str | None = Query(None)` vào endpoint `GET /api/player-seasons`.
  - Service/Repository ánh xạ `group`:
    - `FW` &rarr; `['ST', 'CF']`
    - `MF` &rarr; `['CAM', 'CM', 'CDM', 'LM', 'RM']`
    - `DF` &rarr; `['CB', 'LB', 'RB', 'LWB', 'RWB']`
    - `GK` &rarr; `['GK']`
  - Nếu truyền `group`, repository dùng `WHERE position IN (...)`. Giữ nguyên việc lưu position gốc trong DB.

### 4.4 Gap 4: Cấu hình thứ tự draft trong `TournamentRules` (`draftOrderStrategy`)
- **Vấn đề**: Giao diện Admin hiển thị chuyển đổi giữa "Snake Draft" và "Linear Draft", nhưng schema Pydantic `TournamentRules` chưa có trường này.
- **Đề xuất thay đổi nhỏ nhất**:
  - Thêm trường `draftOrderStrategy: Literal["LINEAR", "SNAKE"] = "LINEAR"` vào Pydantic model `TournamentRules`.
  - Giai đoạn v1 vẫn mặc định thực thi `LinearOrder`, chuẩn bị sẵn field cho `SnakeOrder` mà không làm thay đổi migration DB (vì nằm trong cột JSONB `rules`).

### 4.5 Gap 5: Danh sách picks đầy đủ cho Draft Board (`GET /api/drafts/{id}/picks`)
- **Vấn đề**: Khi client truy cập phòng draft đang diễn ra, client cần tải danh sách các thẻ đã pick của từng đội để lấp đầy 24 ô trên bảng.
- **Đề xuất thay đổi nhỏ nhất**:
  - Chuẩn hóa response schema của endpoint `GET /api/drafts/{id}/picks`:
    ```json
    [
      {
        "id": "uuid",
        "teamId": "uuid",
        "round": 1,
        "turnNumber": 1,
        "salaryAtPick": 28,
        "pickedAt": "2026-09-20T12:00:00Z",
        "playerSeason": {
          "id": "uuid",
          "position": "ST",
          "rating": 116,
          "salary": 28,
          "imageUrl": "https://...",
          "playerName": "K. Mbappé",
          "seasonCode": "24TOTY",
          "seasonBadgeUrl": "/badges/24toty.png"
        }
      }
    ]
    ```

### 4.6 Gap 6: Quản lý đội bóng và liên kết tài khoản trong Admin
- **Vấn đề**:
  1. Admin không có endpoint để xóa team khi setup giải nhầm.
  2. Bảng quản lý đội cần biết đội nào đã có tài khoản điều khiển (`LINKED` vs `UNLINKED`).
- **Đề xuất thay đổi nhỏ nhất**:
  - Thêm endpoint `DELETE /api/tournaments/{id}/teams/{teamId}`: Chỉ cho phép ADMIN xóa khi tournament ở trạng thái `DRAFT` hoặc `READY`.
  - Trong response của `GET /api/tournaments/{id}/teams`, bổ sung trường `assignedUsername: str | None = None`.

### 4.7 Gap 7: Tiêu đề trận đấu (`title`) trong `Match`
- **Vấn đề**: Màn hình Match Bans hiển thị "MATCH #04 · BEST OF 3 · FINALS".
- **Đề xuất thay đổi nhỏ nhất**:
  - Thêm cột `title: VARCHAR(100) NULL` vào bảng `matches` (ví dụ: `"Match 04 - Chung Kết"`).
  - Thêm `title` vào payload `POST /api/tournaments/{id}/matches`.
  - Endpoint `GET /api/matches/{id}` trả về kèm thông tin cơ bản của `homeTeam` và `awayTeam` (tên, short_name, logo_url).

---

## 5. Kết luận

Các khoảng trống (gaps) được chỉ ra trên đây hoàn toàn là các yếu tố hiển thị (display metadata) và tham số hỗ trợ trải nghiệm người dùng (DX/UX). Cấu trúc lõi của state machine (DraftSession, Turn Clock, TimeoutPolicy, Match Bans) trong `docs/design.md` đã bao phủ tới **90%** các yêu cầu nghiệp vụ thực tế của cả 3 màn hình.
