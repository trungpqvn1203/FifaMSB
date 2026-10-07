# Phase 2: Authentication & RBAC

## 1. Mục tiêu & Phạm vi
- Quản lý người dùng (`User`) và phiên đăng nhập (`Session`).
- Phân quyền theo Role: `ADMIN` và `TEAM_USER` (gắn liền với một `team_id`).
- Xác thực bằng Session Cookie: opaque token bảo mật, cờ `HttpOnly`, `SameSite=Lax`, tự động hết hạn sau 72 giờ.
- Mã hóa mật khẩu bằng thư viện `bcrypt` trực tiếp (không qua `passlib`).
- Cung cấp CLI khởi tạo admin ban đầu: `python -m app.auth.create_admin`.

## 2. Danh sách file chính
- `backend/app/auth/domain.py`: Models `User` và `Session`.
- `backend/app/auth/repository.py`: Truy vấn DB người dùng và quản lý session token.
- `backend/app/auth/service.py`: Nghiệp vụ `login`, `logout`, `authenticate_session`, `create_user`.
- `backend/app/auth/dependencies.py`: FastAPI Depends: `get_current_user`, `require_admin`, `get_current_team`.
- `backend/app/auth/api.py`: Schemas và Routers đăng nhập/đăng xuất/me/tạo user.
- `backend/app/auth/create_admin.py`: CLI khởi tạo Admin an toàn và lũy nghiệm.

## 3. API Endpoints
- `POST /api/auth/login`: Xác thực username/password, cấp HttpOnly cookie `session_token`.
- `POST /api/auth/logout`: Xóa session khỏi DB và hủy cookie.
- `GET /api/auth/me`: Lấy thông tin user hiện tại đang đăng nhập.
- `POST /api/admin/users`: Endpoint cho ADMIN tạo user mới và gán `team_id`.

## 4. Quality Gates
- **Tests**: 53/53 PASS
- **Ruff**: PASS | **Mypy strict**: PASS | **Import-linter**: PASS | **Pytest**: PASS

## 5. Các lỗi đã gặp & fix
> Xem `docs/bugs/` nếu có bug liên quan phase này.
