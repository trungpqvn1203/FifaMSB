# Phase 7: Frontend Foundation (React + TypeScript + Vite + Tailwind + Auth)

## 1. Mục tiêu & Phạm vi
- Khởi tạo kiến trúc Frontend bằng **React 19 + TypeScript + Vite** đặt tại thư mục `frontend/`.
- Cấu hình hệ thống Design Tokens theo phong cách **Esports Championship Dark Broadcast HUD** dựa trên `docs/ui/tokens.md`:
  - Bảng màu: Nền tối sâu `bg-app-void` (`#0B0D0E`), các khối panel `surface-panel` (`#13151B`), `surface-card` (`#171922`), `surface-elevated` (`#1F232E`), viền `border-default` (`#242836`), `border-active` (`#3DFF6B`).
  - Điểm nhấn Neon phát sáng: `neon` (`#3DFF6B`), `danger` (`#FF3B4E`), `warning` (`#F5C518`), `cyan` (`#00E3FD`), hiệu ứng đổ bóng `glow-neon`, `glow-danger`, `glow-gold`.
  - Hệ thống phông chữ thể thao: `Space Grotesk` (tiêu đề display), `JetBrains Mono` (đồng hồ số, chỉ số lương, mã tag), `Inter` (nội dung body).
- **Sinh Type Tự Động (OpenAPI TypeScript Codegen)**:
  - Tạo script Python `backend/scripts/export_openapi.py` trích xuất schema FastAPI ra `frontend/src/types/openapi.json`.
  - Sử dụng `openapi-typescript` biên dịch tự động ra `frontend/src/types/api.ts` với đầy đủ các interface của Request/Response schemas, đảm bảo tính an toàn kiểu (type-safety) tuyệt đối giữa Backend và Frontend.
- **Tầng API Client & Xác Thực Cookie (`withCredentials`)**:
  - Khởi tạo `apiClient` bằng Axios hỗ trợ tự động gửi/nhận Cookie Session `session_token` (HttpOnly).
  - Tích hợp interceptor bóc tách cấu trúc lỗi chuẩn RFC 9457 JSON (`ApiError` có `code`, `message`, `status`).
  - Xây dựng `AuthContext` quản lý trạng thái đăng nhập, tự động phục hồi phiên qua `GET /api/auth/me`, cung cấp hàm `login()` và `logout()`.
- **Cấu hình Vite Proxy Thông Minh**:
  - Proxy đường dẫn `/api` về backend `http://127.0.0.1:8000` (giữ nguyên cookie cùng origin).
  - Proxy đường dẫn `/ws` về WebSocket server `ws://127.0.0.1:8000` với cờ `ws: true`.
- **Giao Diện Trang Quản Lý Giải Đấu (Tournaments)**:
  - `LoginPage` (`/login`): Giao diện đăng nhập esports HUD, form validation, thông báo lỗi RFC 9457 rõ ràng, tự động chuyển hướng khi đã có phiên.
  - `TournamentListPage` (`/tournaments`): Danh sách giải đấu với thẻ hiển thị chỉ số luật (ngân sách, roster, thời gian lượt, số lượt cấm), nút tạo giải đấu mới (Modal form dành cho Admin).
  - `TournamentDetailPage` (`/tournaments/:id`): Xem chi tiết luật thi đấu, danh sách các đội đăng ký kèm thanh tiến độ ngân sách, nút Admin thêm đội và nút bắt đầu phiên Draft (`POST /api/tournaments/{id}/draft/start`).
  - `ProtectedRoute`: Chặn truy cập trái phép, tự động điều hướng về `/login` và kiểm soát phân quyền Role (`ADMIN` / `TEAM_USER`).

## 2. Danh sách file chính
- `frontend/package.json`: Khai báo dependencies React, TanStack Query, Axios, Tailwind, Lucide React, openapi-typescript.
- `frontend/vite.config.ts`: Cấu hình path alias `@/` và proxy `/api`, `/ws`.
- `frontend/tailwind.config.js` & `src/index.css`: Cấu hình màu sắc, typography và hiệu ứng phát sáng HUD.
- `backend/scripts/export_openapi.py`: Script xuất FastAPI OpenAPI schema.
- `frontend/src/types/api.ts` & `src/types/domain.ts`: Định nghĩa kiểu dữ liệu đồng bộ từ API.
- `frontend/src/lib/api-client.ts`: Axios client kèm xử lý RFC 9457 `ApiError`.
- `frontend/src/context/AuthContext.tsx`: React Context quản lý phiên đăng nhập người dùng.
- `frontend/src/components/ui/`: Bộ linh kiện UI tái sử dụng (`Button`, `Badge`, `Input`, `Card`, `Modal`).
- `frontend/src/components/layout/AppShell.tsx`: Header HUD thể thao hiển thị logo, trạng thái Live, thông tin tài khoản và nút Logout.
- `frontend/src/pages/LoginPage.tsx`: Trang đăng nhập phong cách Esports.
- `frontend/src/pages/TournamentListPage.tsx`: Trang danh sách và tạo mới giải đấu.
- `frontend/src/pages/TournamentDetailPage.tsx`: Trang chi tiết giải đấu, danh sách đội bóng và khởi động Draft.
- `frontend/src/routes/ProtectedRoute.tsx`: Bộ định tuyến bảo vệ quyền truy cập.
- `frontend/src/App.tsx`: Khởi tạo QueryClientProvider, AuthProvider và Routes.

## 3. Quality Gates
- **Build**: PASS
- **TypeScript**: 0 errors
- **OpenAPI Codegen**: PASS
