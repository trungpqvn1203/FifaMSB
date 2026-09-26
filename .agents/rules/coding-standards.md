# Coding Standards & Architecture

> Phần này tách từ `AGENTS.md` (Nhóm B - tra cứu khi cần).
> Các rules bắt buộc hàng ngày vẫn nằm trong `AGENTS.md` gốc.

---

## Python Coding Style

- **Boring Python**: Không dùng metaprogramming, decorator phức tạp, metaclass, over-abstraction.
- **Type hints**: Bắt buộc trên mọi function (`def foo(x: int) -> str:`). `mypy --strict` phải pass.
- **Small functions**: Mỗi function làm 1 việc, đặt tên rõ ràng, không dead code.
- **Comments**: Chỉ comment khi WHY không hiển nhiên (locking, race condition, timezone).
- **At end of phase**: Thêm section "Python concepts used" (3-5 bullets).
- **No `datetime.now()` / `datetime.utcnow()`**: Luôn dùng `Clock.now()` được inject vào.
- **No `time.sleep()` in tests**: Dùng `FakeClock` thay thế.

## Layer Rules (Dependency Direction)

```
api.py → service.py → domain.py
repository.py → domain.py
```

- `api.py`: Chỉ nhận request, validate, gọi service, return response. **Không business logic**.
- `service.py`: Transaction (`async with session.begin()`), gọi repository, orchestrate domain.
- `domain.py`: SQLAlchemy models + pure business logic. **Không import fastapi, api, repository**.
- `repository.py`: DB queries thuần túy. Không business logic.

## Import-Linter Contracts (phải pass ở CI)

1. `domain` không được import `fastapi`, bất kỳ `api` module, hoặc `repository` module.
2. `pandas` bị cô lập hoàn toàn — chỉ được import trong `app.importer.*`.
3. Routers không được gọi repository trực tiếp — phải qua service.

## Alembic Migration Rules

- **Chỉ Alembic** — KHÔNG `Base.metadata.create_all()` trong app code.
- Mỗi phase = 1 migration riêng. Không tạo bảng của phase sau trong migration sớm.
- Review tay sau khi autogenerate: autogenerate bỏ sót partial index, CHECK constraint, server defaults.
- Enums: `VARCHAR + CHECK constraint` (KHÔNG dùng PG enum type).
- Timestamps: `timestamptz` = `DateTime(timezone=True)`, luôn UTC-aware trong Python.
- Salary/budget: `INT`.

## Naming Convention (SQLAlchemy metadata)

Dùng `naming_convention` trên SQLAlchemy `Base.metadata` để tên constraint ổn định.
Bắt buộc vì `IntegrityError` handling ánh xạ theo **tên constraint** → error code.

## FastAPI Patterns

- Dùng `Depends` cho: `AsyncSession`, `CurrentUser`, `Clock`, services.
- Mọi endpoint phải khai báo rõ access rule qua dependency (`require_admin` hoặc `get_current_user`).
- TEAM_USER: KHÔNG trust `teamId` từ client — resolve từ authenticated user.
- Error format: RFC 9457 `{"type", "title", "status", "code", "message"}`. Không lộ stack trace.

## Testing Rules

- **Integration tests**: LUÔN dùng testcontainers PostgreSQL. KHÔNG SQLite, KHÔNG mock DB.
- **Unit tests**: Không DB, không FastAPI. Chỉ pure Python + `FakeClock`.
- CI commands: `uv run ruff check .` → `uv run mypy --strict app` → `uv run lint-imports` → `uv run pytest`.

## Windows / PowerShell Rules

- Mọi lệnh shell trong docs/scripts dùng PowerShell syntax (Windows).
- Bash-only syntax chỉ dùng trong Docker container.
- `uv` là package manager (`pyproject.toml`, `uv.lock`).
