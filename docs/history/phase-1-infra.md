# Phase 1: Base Infrastructure, Database & Migrations

## 1. Mục tiêu & Phạm vi
- Thiết lập khung dự án backend theo mô hình **package-by-feature** chuẩn: `app/{common, auth, player, tournament, team, draft, match, importer}`.
- Cấu hình quản lý môi trường, kết nối Async SQLAlchemy 2.0 với PostgreSQL 16 qua `asyncpg`.
- Xây dựng hệ thống Domain Errors chuẩn RFC 9457 (`{"type", "title", "status", "code", "message"}`).
- Thiết lập trừu tượng thời gian: `Clock`, `SystemClock` (timezone-aware UTC) và `FakeClock` cho unit tests.
- Khởi tạo Alembic Migration 0001 khởi tạo extension `pg_trgm`, `unaccent`, hàm `immutable_unaccent` và bảng cơ sở.

## 2. Danh sách file chính
- `backend/app/config.py`: `pydantic-settings` quản lý biến môi trường.
- `backend/app/db.py`: Async engine và session factory (`AsyncSession`).
- `backend/app/common/clock.py`: Protocol `Clock`, `SystemClock`, `FakeClock`.
- `backend/app/common/base_model.py`: SQLAlchemy Base với `naming_convention` ổn định tên constraint.
- `backend/app/common/errors.py`: Base class `DomainError` và các exception nghiệp vụ.
- `backend/app/main.py`: Khởi tạo FastAPI app, cấu hình lifespan, middleware request-id, và exception handler.
- `backend/alembic/versions/0001_initial_schema.py`: Migration đầu tiên.

## 3. API Endpoints
- `GET /health`: Kiểm tra sức khỏe dịch vụ (`{"status": "ok"}`).

## 4. Quality Gates
- **Tests**: 12/12 PASS
- **Ruff**: PASS | **Mypy strict**: PASS | **Import-linter**: PASS | **Pytest**: PASS
