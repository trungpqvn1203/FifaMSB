# FC Online Draft System — Design Tokens & UI Component System

Tài liệu này chuẩn hóa toàn bộ Design Tokens (màu sắc, typography, spacing, border radius, elevation) và danh sách Reusable Components được trích xuất trực tiếp từ các nguyên mẫu giao diện trong thư mục `docs/ui/` (`draft-board.html`, `admin-tournament.html`, `match-bans.html`).

Hệ thống thiết kế theo phong cách **Esports Championship Dark Broadcast HUD**: hiện đại, tương phản cao, góc cạnh thể thao điện tử chuyên nghiệp, tối ưu cho màn hình Full HD / 2K (1920x1080).

---

## 1. Color Palette (Bảng màu)

Hệ màu sử dụng bảng Dark Mode chuyên sâu kết hợp điểm nhấn Neon phát sáng đặc trưng của FC Online / FIFA Pro tournaments.

### 1.1 Base & Surfaces (Nền và Khối chứa)

| Token Name | Hex Code | Tailwind Equivalent | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| `bg-app-void` | `#0B0D0E` | `bg-[#0b0d0e]` | Nền tối tuyệt đối toàn ứng dụng (Draft Board, Match Ban) |
| `bg-app-dark` | `#0E0E0E` | `bg-[#0e0e0e]` | Nền admin / trang quản trị |
| `surface-panel` | `#13151B` | `bg-[#13151b]` | Nền panel chính, bảng phân cột team, container chính |
| `surface-card` | `#171922` | `bg-[#171922]` | Card cầu thủ, ô webcam, table row |
| `surface-elevated` | `#1F232E` | `bg-[#1f232e]` | Dropdown, popover, drawer nổi, tooltip |
| `surface-glass` | `rgba(17, 18, 23, 0.85)` | `bg-[#111217]/85 backdrop-blur-md` | Sticky top header, dock bar cố định ở đáy màn hình |

### 1.2 Borders & Dividers (Đường viền)

| Token Name | Hex Code | Tailwind Equivalent | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| `border-subtle` | `#1D202B` | `border-[#1d202b]` | Phân cách dòng nhẹ, divider phụ |
| `border-default` | `#242836` | `border-[#242836]` | Viền card, viền table header, viền panel mặc định |
| `border-prominent`| `#38424B` | `border-[#38424b]` | Viền input, container khi hover |
| `border-active` | `#3DFF6B` | `border-[#3DFF6B]` | Viền đội đang đến lượt pick, viền thẻ được chọn |

### 1.3 Esports Accents (Màu nhận diện & Tín hiệu)

| Token Name | Hex Code | Glow / Container | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Brand Neon Green** | `#3DFF6B` | `rgba(61, 255, 107, 0.25)` | Trạng thái ACTIVE, Turn đang pick, nút CTA chính, Live indicator |
| **Neon Hover** | `#32E05B` | - | Trạng thái hover của nút Neon |
| **Danger Crimson** | `#FF3B4E` | `rgba(255, 59, 78, 0.25)` | Nút BAN, trạng thái BANNED, cảnh báo hết giờ (< 5s), lỗi |
| **Warning Amber/Gold** | `#F5C518` | `rgba(245, 197, 24, 0.25)` | Trạng thái PAUSED, đội ON DECK, cảnh báo ngân sách sắp cạn |
| **Electric Cyan** | `#00E3FD` | `rgba(0, 227, 253, 0.20)` | Cầu thủ cánh (LW/RW), chip thông tin phụ, filter đang bật |
| **Info / Purple** | `#A855F7` | `rgba(168, 85, 247, 0.20)` | Tiền vệ tấn công (CAM), thẻ đặc biệt ICON |

### 1.4 FC Online Position Colors (Chuẩn màu vị trí bóng đá)

| Nhóm vị trí | Vị trí chi tiết | Mã màu Text | Mã màu Nền Tag |
| :--- | :--- | :--- | :--- |
| **FW (Tiền đạo)** | `ST`, `CF` | `#FBBF24` (Amber-400) | `rgba(251, 191, 36, 0.12)` |
| **WING (Tiền đạo cánh)**| `LW`, `RW` | `#22D3EE` (Cyan-400) | `rgba(34, 211, 238, 0.12)` |
| **AM (Tấn công)** | `CAM` | `#C084FC` (Purple-400) | `rgba(192, 132, 252, 0.12)` |
| **MF (Tiền vệ trung tâm)**| `CM`, `LM`, `RM` | `#818CF8` (Indigo-400) | `rgba(129, 140, 248, 0.12)` |
| **DM (Tiền vệ phòng ngự)**| `CDM` | `#34D399` (Emerald-400) | `rgba(52, 211, 153, 0.12)` |
| **DF (Hậu vệ)** | `CB`, `LB`, `RB`, `LWB`, `RWB` | `#60A5FA` (Blue-400) / `#38BDF8` (Sky) | `rgba(96, 165, 250, 0.12)` |
| **GK (Thủ môn)** | `GK` | `#FACC15` (Yellow-400) | `rgba(250, 204, 21, 0.12)` |

### 1.5 Typography Colors (Màu văn bản)

| Token Name | Hex Code | Mục đích |
| :--- | :--- | :--- |
| `text-primary` | `#FFFFFF` | Tiêu đề chính, tên cầu thủ, số áo, chỉ số OVR |
| `text-secondary` | `#E0E3EB` | Nhãn form, văn bản phụ, tên đội bóng |
| `text-muted` | `#9CA3AF` | Thông số kỹ thuật, label phụ, placeholder |
| `text-dim` | `#6B7280` | ID, timestamp, đường dẫn tĩnh, text disabled |
| `text-on-neon` | `#000000` | Chữ hiển thị trên nền nút Neon Green |

---

## 2. Typography System (Hệ thống phông chữ)

Sử dụng 3 họ phông chữ phục vụ 3 mục đích chuyên biệt:

1. **`Space Grotesk`** (`font-display`): Tiêu đề giải đấu, tên đội bóng, card headers, CTA buttons. Mang phong cách góc cạnh thể thao công nghệ cao.
2. **`JetBrains Mono`** (`font-mono` / `font-digital`): Đồng hồ đếm ngược, chỉ số OVR, điểm lương (Salary Cap), lượt round/turn, mã code season.
3. **`Inter` hoặc `Geist`** (`font-sans`): Nội dung bảng, mô tả, nhãn form, văn bản đọc dài.

### 2.1 Thang kích thước (Font Size & Line Height)

| Token Class | Kích thước / Line-height | Font Family & Weight | Áp dụng thực tế |
| :--- | :--- | :--- | :--- |
| `display-timer` | `48px - 60px` / `1.0` | `JetBrains Mono` Black (900) | Số đếm ngược Timer HUD (`00:24`) |
| `headline-xl` | `24px - 28px` / `1.2` | `Space Grotesk` Black (900) | Tên đội bóng chính trên Header |
| `headline-lg` | `18px - 20px` / `1.25` | `Space Grotesk` Bold (700) | Tiêu đề khối (Friendly Roster, Pool Drawer) |
| `headline-md` | `14px - 16px` / `1.3` | `Space Grotesk` Bold (700) | Tên mục cấu hình, tên cột bảng draft |
| `body-md` | `13px - 14px` / `1.4` | `Inter` SemiBold (600) | Tên cầu thủ trong danh sách pick |
| `body-sm` | `12px` / `1.4` | `Inter` Regular (400) | Mô tả phụ, hướng dẫn thao tác |
| `mono-data-md` | `12px - 13px` / `1.0` | `JetBrains Mono` Bold (700) | Chỉ số OVR, Salary Cap (`28 pts`, `305/305`) |
| `mono-tag-sm` | `10px - 11px` / `1.0` | `JetBrains Mono` Bold (700) | Badge mùa giải (`24TOTY`), vị trí (`ST`, `GK`) |

---

## 3. Spacing & Sizing Scale (Khoảng cách & Kích thước)

Dựa trên lưới 4px cơ sở (`rem` scale chuẩn Tailwind):

| Token | Pixels | Áp dụng chính |
| :--- | :--- | :--- |
| `space-1` | `4px` | Padding trong badge vị trí, khoảng cách icon nhỏ |
| `space-2` | `8px` | Gap giữa avatar và tên, padding trong ô player row |
| `space-3` | `12px` | Khoảng cách giữa các chip bộ lọc, margin giữa các card nhỏ |
| `space-4` | `16px` | Padding trong các panel chính, gap giữa 2 cột |
| `space-6` | `24px` | Khoảng cách giữa các section lớn, header padding |
| `space-8` | `32px` | Margin biên trên màn hình TV/broadcast |

---

## 4. Border Radius (Bo góc)

Thiết kế giữ phong cách bán góc cạnh (chỉ bo nhẹ để duy trì cảm giác công nghệ esports mạnh mẽ):

| Token | Giá trị | Sử dụng cho |
| :--- | :--- | :--- |
| `rounded-none` | `0px` | Khung video stream, đường viền quét scanline broadcast |
| `rounded-sm` | `4px` | Tag vị trí (`ST`, `CB`), badge mùa giải (`ICON`), pill trạng thái |
| `rounded-md` | `6px` | Nút phụ, chip filter, input form |
| `rounded-lg` | `8px` | Nút CTA chính, item card cầu thủ, modal popup nhỏ |
| `rounded-xl` | `12px` | Cột bảng draft 24 slots, panel điều khiển, khung webcam |
| `rounded-full` | `9999px` | Chấm tròn tín hiệu ping trạng thái, badge đếm số lượng |

---

## 5. Shadows & Glow Effects (Hiệu ứng phát sáng HUD)

| Tên hiệu ứng | CSS / Box Shadow | Mục đích |
| :--- | :--- | :--- |
| `glow-neon` | `0 0 16px rgba(61, 255, 107, 0.35)` | Nút xác nhận pick, viền đội đang đến lượt |
| `glow-danger` | `0 0 16px rgba(255, 59, 78, 0.40)` | Thẻ cầu thủ bị cấm (BANNED), cảnh báo hết giờ |
| `glow-gold` | `0 0 16px rgba(245, 197, 24, 0.35)` | Trạng thái tạm dừng hoặc chờ đối thủ khóa ban |
| `shadow-panel` | `0 20px 25px -5px rgba(0, 0, 0, 0.6)` | Cột danh sách draft và modal tìm kiếm |

---

## 6. Danh sách Reusable UI Components (Thành phần tái sử dụng)

Hệ thống UI bao gồm 14 thành phần cốt lõi có thể đóng gói thành React/TypeScript component:

### 6.1 `BroadcastHeader`
- **Mô tả**: Thanh điều hướng trên cùng hiển thị nhận diện giải đấu, phiên hiệu phòng (`DRAFT ROOM #01`), ping mạng / server và nút chuyển đổi góc nhìn.
- **Props**: `tournamentName: string`, `roomCode: string`, `serverLatency?: number`, `phaseLabel: string`.

### 6.2 `TimerHUD`
- **Mô tả**: Cụm đồng hồ trung tâm hiển thị thời gian còn lại của lượt pick/ban, hiệu ứng nhấp nháy khi còn dưới 5 giây, kèm tên đội đang sở hữu lượt.
- **Props**: `turnExpiresAt: string`, `remainingMillis: number`, `isWarning: boolean`, `statusText: string`, `activeTeamName: string`.

### 6.3 `TeamDraftColumn`
- **Mô tả**: Cột dọc của từng đội trên bảng Draft Board, hiển thị danh sách 24 slot cầu thủ được pick theo thời gian thực.
- **Props**: `team: TeamSummary`, `picks: DraftPick[]`, `isCurrentTurn: boolean`, `isOnDeck: boolean`, `rosterSize: number`.

### 6.4 `TeamHeaderCard`
- **Mô tả**: Đầu cột của từng đội, chứa Logo, Short code, Tên đội, Thanh ngân sách (`budgetUsed / budgetTotal`), số lượng đã pick (`pickedCount / rosterSize`).
- **Props**: `teamName: string`, `shortCode: string`, `budgetUsed: number`, `budgetTotal: number`, `pickedCount: number`, `rosterSize: number`, `draftOrder: number`.

### 6.5 `PlayerRowItem`
- **Mô tả**: Một dòng hiển thị thông tin cầu thủ trong danh sách 24 slot hoặc trong bảng tra cứu.
- **Props**: `position: string`, `seasonCode: string`, `seasonBadgeUrl?: string`, `name: string`, `rating?: number`, `salary: number`, `status?: 'ACTIVE' | 'BENCH' | 'BANNED'`.

### 6.6 `PlayerPoolDrawer` (Bảng chọn cầu thủ tự do)
- **Mô tả**: Khối tìm kiếm cầu thủ tự do bật lên khi đến lượt đội nhà pick. Tích hợp thanh tìm kiếm không dấu, bộ lọc vị trí và bảng danh sách có thể cuộn ảo (virtual scroll).
- **Props**: `isOpen: boolean`, `allowedSeasons: Season[]`, `onSelectPlayer: (playerSeasonId: string) => void`, `budgetRemaining: number`, `isSubmitting: boolean`.

### 6.7 `PositionFilterChips`
- **Mô tả**: Thanh chọn nhóm vị trí nhanh: `ALL`, `FW`, `MF`, `DF`, `GK` với màu tương ứng.
- **Props**: `selectedGroup: string`, `onChange: (group: string) => void`, `counts?: Record<string, number>`.

### 6.8 `WebcamCard`
- **Mô tả**: Khung phát webcam/stream của các đội trưởng trong lúc thi đấu để tăng tính minh bạch giải đấu.
- **Props**: `teamShortCode: string`, `teamName: string`, `streamUrl?: string`, `isLive: boolean`, `isCurrentTurn: boolean`.

### 6.9 `BanTargetCard`
- **Mô tả**: Thẻ cầu thủ đội đối thủ trên màn hình Match Bans, cho phép click để chọn Ban hoặc hiển thị gạch ngang khi đã bị cấm.
- **Props**: `player: PlayerRosterItem`, `isBanned: boolean`, `isSelecting: boolean`, `onToggleBan: () => void`.

### 6.10 `RosterShieldCard`
- **Mô tả**: Thẻ cầu thủ của đội mình trên màn hình Match Bans ở chế độ ẩn danh (Blind Shield) giúp theo dõi đội hình nhà trong khi đối thủ đang chọn cấm.
- **Props**: `player: PlayerRosterItem`.

### 6.11 `BanProgressBar`
- **Mô tả**: Thanh đo tiến trình cấm (ví dụ: đã chọn `3/5` lượt cấm), đổi màu từ đỏ sang xanh khi đủ quota và sẵn sàng khóa.
- **Props**: `currentCount: number`, `maxCount: number`.

### 6.12 `BottomTacticalDock`
- **Mô tả**: Thanh điều khiển cố định ở chân trang màn hình Ban, chứa nút hoàn tác (Undo) và nút khóa cấm (Lock Bans & Ready).
- **Props**: `banCount: number`, `maxBans: number`, `onUndo: () => void`, `onConfirm: () => void`, `isLocked: boolean`, `isOpponentLocked: boolean`.

### 6.13 `CSVVerificationReport`
- **Mô tả**: Bảng thống kê chi tiết kết quả thẩm định file CSV tải lên (Tổng số dòng, Hợp lệ, Cảnh báo, Lỗi nghiêm trọng, Log kiểm tra).
- **Props**: `report: ImportReportPayload`, `onApplyCorrections?: () => void`.

### 6.14 `NumericStepperInput`
- **Mô tả**: Ô nhập thông số giải đấu kèm nút tăng giảm nhanh (+/-) cho Budget (305), Pick Time (30s), Ban Count (5).
- **Props**: `value: number`, `min: number`, `max: number`, `step: number`, `onChange: (val: number) => void`, `suffix?: string`.
