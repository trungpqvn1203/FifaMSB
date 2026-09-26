# Hướng Dẫn Chạy Môi Trường Local Dev & Tự Kiểm Thử (Phase 7+)

Tài liệu này hướng dẫn chi tiết từng bước để bạn tự chạy toàn bộ hệ thống (Database PostgreSQL, Backend FastAPI và Frontend React Vite) trên máy tính cá nhân (Windows PowerShell), cũng như các bước kiểm thử giao diện.

---

## 🛠️ 1. Chuẩn Bị Công Cụ Cần Thiết

Đảm bảo máy tính đã cài đặt:
1. **Docker Desktop** (đã bật và đang chạy).
2. **Python 3.12+** cùng công cụ quản lý gói **`uv`** (chạy `uv --version`).
3. **Node.js 18+** cùng **`npm`** (chạy `node -v` và `npm -v`).

---

## 🚀 2. Các Bước Khởi Động Hệ Thống

Mở 3 cửa sổ **Windows PowerShell** độc lập cho từng dịch vụ:

### Cửa sổ 1: Khởi động Cơ sở dữ liệu (PostgreSQL qua Docker)

```powershell
# Di chuyển vào thư mục backend
cd D:\VideCode\WebFifa\backend

# Khởi chạy PostgreSQL container chạy nền trên cổng 5435 (tránh trùng cổng 5432 máy local)
docker compose -f docker-compose.dev.yml up -d

# Chạy migration để khởi tạo và cập nhật các bảng (tournaments, drafts, matches, match_bans, ...)
uv run alembic upgrade head

# Tạo tài khoản Admin ban đầu (nếu chưa có)
uv run python -m app.auth.create_admin --username admin --password admin_pass
```

> **Ghi chú**: 
> - File cấu hình kết nối DB nằm tại: `backend/.env` với `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5435/webfifa`.
> - Tài khoản mặc định:
>   - **Username**: `admin`
>   - **Password**: `admin_pass`
>   - **Role**: `ADMIN`

---

### Cửa sổ 2: Khởi động Backend Server (FastAPI + Uvicorn)

```powershell
# Di chuyển vào thư mục backend
cd D:\VideCode\WebFifa\backend

# Khởi chạy máy chủ API trên cổng 8000
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- API Docs (Swagger UI): `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health` (trả về `{"status": "ok"}`)

---

### Cửa sổ 3: Khởi động Frontend Dev Server (React + Vite)

```powershell
# Di chuyển vào thư mục frontend
cd D:\VideCode\WebFifa\frontend

# Cài đặt thư viện (nếu mới clone hoặc thêm package)
npm install

# Khởi chạy Vite dev server trên cổng 5173
npm run dev
```

- Địa chỉ truy cập ứng dụng web: `http://localhost:5173`

> **Cơ chế Reverse Proxy của Frontend**:
> Frontend Vite được cấu hình proxy tự động trong `vite.config.ts`:
> - Mọi request `/api/*` từ browser gọi đến `http://localhost:5173/api/*` sẽ được Vite chuyển tiếp ngầm sang `http://127.0.0.1:8000/api/*`.
> - Mọi WebSocket `/ws/*` cũng được proxy tới `ws://127.0.0.1:8000/ws/*`.
> - Nhờ đó, trình duyệt không bị lỗi CORS và cookie xác thực `session_token` (`HttpOnly`, `SameSite=Lax`) hoạt động mượt mà mà không cần tạo file `.env` riêng cho Frontend khi chạy local.

---

## 🧪 3. Quy Trình Tự Kiểm Thử Giao Diện (Step-by-Step UI Verification)

### Bước 1: Kiểm thử Xác thực (Login)
1. Mở trình duyệt truy cập: `http://localhost:5173`.
2. Hệ thống sẽ tự động chuyển hướng (redirect) về trang: `http://localhost:5173/login`.
3. Nhập thông tin đăng nhập:
   - **Username**: `admin`
   - **Password**: `admin_pass`
4. Bấm nút **ĐĂNG NHẬP**:
   - Nếu nhập sai mật khẩu: Hiển thị thông báo lỗi màu đỏ (RFC 9457).
   - Nếu đăng nhập thành công: Trình duyệt lưu cookie `session_token` và tự động chuyển về trang `/tournaments`.

---

### Bước 2: Kiểm thử Trang Danh Sách Giải Đấu (Tournament Hub)
1. Trên thanh Header (AppShell):
   - Logo **FC MSB PRO** kèm chấm xanh nhấp nháy **HỆ THỐNG TRỰC TIẾP**.
   - Góc phải hiển thị thông tin tài khoản: `admin` kèm huy hiệu **Quản trị viên (Admin)**.
2. Bấm nút **+ TẠO GIẢI ĐẤU** (nút màu Neon Green góc trên bên phải).
3. Hộp thoại (Modal) tạo giải đấu hiện lên:
   - **Tên giải đấu**: Nhập tên giải (ví dụ: `FVPL SUMMER 2026: RISE TO INFINITY`).
   - **Quỹ lương tối đa (Salary Budget)**: `305` (hoặc tùy chỉnh).
   - **Quy mô đội hình (Roster Size)**: `10` (hoặc `24`).
   - **Thời gian mỗi lượt Pick (giây)**: `30` giây.
   - **Quy tắc tính trùng thẻ (Unique Rule)**: `Theo danh tính Cầu Thủ (Player Identity)` hoặc `Theo Thẻ Cụ Thể (Card Instance)`.
4. Bấm **Khởi Tạo Giải Đấu**:
   - Modal đóng lại, giải đấu mới tạo sẽ lập tức xuất hiện trong danh sách với trạng thái màu cam **BẢN NHÁP**.
   - Thẻ giải đấu hiển thị đầy đủ các thông số Quỹ lương, Quy mô đội hình, Đồng hồ lượt pick, Số lượt ban.

---

### Bước 3: Kiểm thử Trang Chi Tiết Giải Đấu (Tournament Detail)
1. Bấm nút **VÀO GIẢI ĐẤU** (nút có icon mũi tên) trên thẻ giải đấu vừa tạo.
2. Trình duyệt chuyển tới URL: `/tournaments/<id-giải-đấu>`.
3. Bạn sẽ thấy:
   - Tiêu đề giải đấu, ngày tạo, trạng thái hiện tại (`BẢN NHÁP`).
   - 6 thẻ tóm tắt luật thi đấu (Quỹ lương, Quy mô đội hình, Thời gian pick, Lượt ban trận đấu, Quy tắc trùng, Xử lý hết giờ).
   - Danh sách đội tham gia (ban đầu trống).
   - Khối Đăng Ký Đội (Đội Trưởng & Mật Khẩu, Tên Đội, Tên Rút Gọn, Ngân Sách).

---

### Bước 4: Kiểm thử Quản Lý Đội & Bắt Đầu Draft
1. Tại trang chi tiết giải đấu, cuộn xuống phần **Đăng ký Đội tham dự**:
   - Nhập thông tin tạo Đội 1 (ví dụ: `DIESEL ESPORTS`, tag: `DSL`).
   - Nhập thông tin tạo Đội 2 (ví dụ: `PRO GAMER`, tag: `PGR`).
2. Sau khi tạo xong ít nhất 2 đội, nút **BẮT ĐẦU DRAFT** sẽ khả dụng (chỉ Admin mới có quyền).
3. Bấm **BẮT ĐẦU DRAFT**:
   - Hệ thống chuyển trạng thái giải đấu sang **DRAFTING**.
   - Tự động sinh `DraftSession` và hiển thị nút **VÀO PHÒNG DRAFT** (Draft Board).

---

### Bước 5: Kiểm thử Phòng Draft Trực Tiếp (Draft Board)
1. Bấm **VÀO PHÒNG DRAFT** (URL: `/drafts/<draft_id>`).
2. Giao diện Draft Board trực tiếp theo phong cách FC Online xuất hiện:
   - **Đồng hồ đếm ngược**: Hiển thị thời gian còn lại của lượt pick hiện tại.
   - **Thanh thứ tự lượt (Draft Turn Strip)**: Hiển thị thứ tự các đội đang pick và các lượt tiếp theo.
   - **Catalogue thẻ cầu thủ**: Bộ lọc theo Mùa thẻ, Vị trí (FW, MF, DF, GK), Tìm kiếm tên cầu thủ tiếng Việt không dấu (Unaccent), sắp xếp theo OVR / Lương.
   - **Đội hình hiện tại của từng đội**: Hiển thị danh sách cầu thủ đã pick, tổng lương đã dùng và quỹ lương còn lại.
3. Thao tác Pick:
   - Nhấp vào một thẻ cầu thủ hợp lệ (còn đủ quỹ lương và chưa bị pick theo quy tắc Unique).
   - Bấm **XÁC NHẬN CHỌN (PICK)**.
   - Lượt pick chuyển sang đội kế tiếp và cập nhật tức thì realtime.
