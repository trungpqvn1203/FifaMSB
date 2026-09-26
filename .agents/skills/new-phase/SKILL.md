---
name: new-phase
description: Checklist chuẩn để bắt đầu một phase mới trong dự án FIFA/FC Online Draft. Dùng khi người dùng nói "bắt đầu Phase X" hoặc "implement Phase X".
---

# Checklist: Bắt đầu Phase mới

## Bước 1 — Đọc context (đừng bỏ qua)

1. Đọc `CONTEXT.md` (root) — xác nhận phase hiện tại và trạng thái DB.
2. Đọc `docs/Roadmap .md` → section của phase cần làm — lấy danh sách deliverables và acceptance criteria.
3. Xác nhận CI đang xanh trước khi bắt đầu:
   ```powershell
   cd D:\VideCode\WebFifa\backend
   uv run ruff check .
   uv run mypy --strict app
   uv run lint-imports
   uv run pytest
   ```
   Nếu có test fail → **DỪNG LẠI**, báo cáo, không bắt đầu phase mới.

## Bước 2 — Inspect cấu trúc hiện có

- Xem `backend/app/` — feature folder nào đã có, file nào đã có.
- **Không overwrite** file đã tồn tại mà không báo trước.
- Đọc section domain liên quan trong `docs/design/` (chỉ file cần thiết, không đọc hết).

## Bước 3 — Plan trước khi code

- Liệt kê: files sẽ tạo mới, files sẽ sửa, migration cần tạo.
- Nếu cần migration: tạo file `alembic/versions/00XX_<phase_name>.py` — KHÔNG autogenerate mù.
- Xác nhận layering: domain.py → repository.py → service.py → api.py.

## Bước 4 — Implement (theo thứ tự)

1. `domain.py` — SQLAlchemy models, constraints, pure business logic
2. `repository.py` — DB queries
3. `service.py` — transactions, orchestration
4. `api.py` — Pydantic schemas, routers
5. `tests/unit/` — pure Python tests (FakeClock, no DB)
6. `tests/integration/` — testcontainers PostgreSQL

## Bước 5 — Quality Gates (bắt buộc trước khi báo hoàn thành)

```powershell
uv run ruff check .
uv run mypy --strict app
uv run lint-imports
uv run pytest
```

Tất cả phải PASS. Không được có warning mypy bị suppress.

## Bước 6 — Báo cáo và DỪNG

Sau khi CI pass, báo cáo:
- Danh sách files đã tạo/sửa
- Số tests (trước/sau)
- Deviations (nếu có)
- Section "Python concepts used" (3-5 bullets)
- Cập nhật `CONTEXT.md` — sửa trạng thái phase, cập nhật DB state nếu có migration mới

**STOP và chờ xác nhận** — không tự bắt đầu phase tiếp theo.
