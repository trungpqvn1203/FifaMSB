# Phase 3: Seasons, Player Catalogue & Importer Pipeline (CSV ETL)

## 1. Mục tiêu & Phạm vi
- Xây dựng danh mục mùa giải (`Season`), cầu thủ gốc (`Player`), và thẻ mùa giải (`PlayerSeason`).
- Pipeline ETL nhập dữ liệu cầu thủ từ CSV theo chuẩn Data Engineering (Extract - Transform - Load):
  - **Extract**: Đọc streaming theo batch với `pandas.read_csv(chunksize=500)`. Lưu ý: thư viện `pandas` chỉ được phép dùng duy nhất trong module `app/importer/`.
  - **Transform**: Validate dữ liệu bằng Pydantic model (`ValidatedPlayerRow`): bắt buộc `external_player_id`, lương `salary >= 1`, vị trí chuẩn game. Bỏ qua và thống kê dòng lỗi.
  - **Load**: Batch upsert vào PostgreSQL với `ON CONFLICT (external_player_id) DO UPDATE` và `ON CONFLICT (player_id, season_id) DO UPDATE`. Tự tạo mùa giải nếu gặp mã mới. Đảm bảo tính lũy nghiệm (re-import nhiều lần không trùng dữ liệu, cập nhật lại lương).
- Giữ nguyên 15 vị trí gốc của FC Online (`ST`, `CF`, `LW`, `RW`, `CAM`, `CM`, `CDM`, `LM`, `RM`, `CB`, `LB`, `RB`, `LWB`, `RWB`, `GK`), gom 4 nhóm chuẩn (`FW`, `MF`, `DF`, `GK`) tại một nơi duy nhất.
- Hỗ trợ tìm kiếm tên cầu thủ tiếng Việt không dấu nhờ chỉ mục GIN `pg_trgm` và hàm `immutable_unaccent`.
- Cơ chế khóa Pool (`PoolLockPolicy`): Ngăn chặn đổi lương hoặc re-import khi Draft đang diễn ra (`POOL_LOCKED`, HTTP 422).
- Tạo tập dữ liệu mẫu `data/sample_players.csv` gồm 379 thẻ cầu thủ chân thực.

## 2. Danh sách file chính
- `backend/app/player/domain.py`: Models `Season`, `Player`, `PlayerSeason`.
- `backend/app/player/position.py`: 15 vị trí game, ánh xạ nhóm `FW|MF|DF|GK`, hàm chuẩn hóa.
- `backend/app/player/pool_lock.py`: Protocol `PoolLockPolicy` và class `DefaultPoolLockPolicy`.
- `backend/app/player/repository.py`: Truy vấn mùa giải, phân trang, lọc và tìm kiếm unaccent.
- `backend/app/player/service.py`: Nghiệp vụ mùa giải, cầu thủ, đổi lương kèm kiểm tra PoolLock.
- `backend/app/player/api.py`: Schemas và Routers cho Season, PlayerSeason, Admin player management.
- `backend/app/importer/extract.py`: Đọc file CSV dạng luồng chunk.
- `backend/app/importer/transform.py`: Lọc và validate từng dòng dữ liệu.
- `backend/app/importer/load.py`: Batch upsert vào cơ sở dữ liệu PostgreSQL.
- `backend/app/importer/pipeline.py`: Điều phối toàn bộ pipeline ETL và tạo `ImportReport`.
- `backend/app/importer/__main__.py`: CLI tool chạy ETL `python -m app.importer --file ...`.
- `data/sample_players.csv`: 379 thẻ cầu thủ FC Online mẫu (quốc tế & Việt Nam).

## 3. API Endpoints
- `GET /api/seasons`: Lấy danh sách tất cả các mùa giải.
- `POST /api/seasons`: (ADMIN) Tạo mùa giải mới.
- `GET /api/player-seasons`: Phân trang danh sách thẻ cầu thủ, lọc theo `seasonId`, `position`, `group` (`FW|MF|DF|GK`), tìm kiếm tiếng Việt không dấu qua param `search`.
- `GET /api/player-seasons/{id}`: Xem chi tiết một thẻ cầu thủ.
- `PATCH /api/admin/player-seasons/{id}`: (ADMIN) Cập nhật lương thẻ cầu thủ (`salary >= 1`), kiểm tra khóa pool.
- `POST /api/admin/players/import`: (ADMIN) Tải lên file CSV multipart để chạy ETL nhập dữ liệu.

## 4. Quality Gates
- **Tests**: 74/74 PASS
- **Ruff**: PASS | **Mypy strict**: PASS | **Import-linter**: PASS | **Pytest**: PASS
