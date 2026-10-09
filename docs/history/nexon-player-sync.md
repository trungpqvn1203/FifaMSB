# Feature: Đồng Bộ Dữ Liệu Cầu Thủ FC Online Nexon

> **Hoàn thành**: 2026-10-09
> **Mục tiêu**: Tích hợp cào/đồng bộ trực tiếp thẻ cầu thủ từ Nexon Open API và DataCenter Hàn Quốc vào hệ thống WebFifa mà **không thay đổi cấu trúc Database**.

---

## 1. Mục tiêu & Phạm vi

- **Không thay đổi Schema DB**: Tái sử dụng trọn vẹn 3 bảng `seasons`, `players`, `player_seasons` và pipeline `load_chunk` của PostgreSQL.
- **Nguồn dữ liệu Nexon**:
  - Metadata tĩnh: `https://open.api.nexon.com/static/fconline/meta/{seasonid,spid,spposition}.json`.
  - Ảnh CDN: `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p{spid}.png` và `.../players/p{pid}.png`.
  - Chi tiết chỉ số: `POST https://fconline.nexon.com/datacenter/PlayerAbility` với `X-Requested-With: XMLHttpRequest` bypass GeoIP redirect.
- **Hỗ trợ tên tiếng Anh**: Tự động nhận diện `backend/data/spid_english.json` để chuyển tên cầu thủ sang tiếng Anh chuẩn (Cristiano Ronaldo, Oliver Kahn, David Beckham).
- **Idempotent & Safe**: Upsert an toàn, kiểm tra `PoolLockPolicy` (không cho phép sửa khi draft đang diễn ra).

---

## 2. Các file đã tạo và chỉnh sửa

### Backend
1. [`app/importer/nexon_client.py`](file:///d:/VideCode/WebFifa/backend/app/importer/nexon_client.py) *(Mới)*: Client async (`httpx`) với timeout, exponential backoff và retry tự động.
2. [`app/importer/nexon_parser.py`](file:///d:/VideCode/WebFifa/backend/app/importer/nexon_parser.py) *(Mới)*: Parser trích xuất OVR, lương (salary), vị trí, 6 chỉ số FC (pace, shooting, passing, dribbling, defending, physical), chiều cao, cân nặng, chân thuận, kĩ thuật, traits và ảnh thẻ.
3. [`app/importer/nexon_pipeline.py`](file:///d:/VideCode/WebFifa/backend/app/importer/nexon_pipeline.py) *(Mới)*: Pipeline xử lý batch, kiểm tra pool lock, ánh xạ metadata và gọi `load_chunk` batch upsert.
4. [`app/importer/transform.py`](file:///d:/VideCode/WebFifa/backend/app/importer/transform.py) *(Cập nhật)*: Mở rộng `ValidatedPlayerRow` hỗ trợ 6 chỉ số core stats.
5. [`app/importer/load.py`](file:///d:/VideCode/WebFifa/backend/app/importer/load.py) *(Cập nhật)*: `load_chunk` lưu trữ thêm 6 chỉ số core stats vào `player_seasons`.
6. [`app/player/api.py`](file:///d:/VideCode/WebFifa/backend/app/player/api.py) *(Cập nhật)*: Thêm endpoint `POST /api/admin/players/sync-nexon` (Admin only, có schema `NexonSyncRequest`).
7. [`tests/unit/test_nexon_importer.py`](file:///d:/VideCode/WebFifa/backend/tests/unit/test_nexon_importer.py) *(Mới)*: 8 unit tests kiểm tra parser ST, GK, malformed HTML, fallbacks, client retries, pipeline success và pool lock.
8. [`tests/integration/test_player_api.py`](file:///d:/VideCode/WebFifa/backend/tests/integration/test_player_api.py) *(Cập nhật)*: Integration test kiểm tra endpoint `POST /api/admin/players/sync-nexon`.

### Frontend
1. [`src/lib/admin-api.ts`](file:///d:/VideCode/WebFifa/frontend/src/lib/admin-api.ts) *(Cập nhật)*: Thêm hàm `syncNexonPlayers(spids)`.
2. [`src/components/admin/AdminCsvImportSection.tsx`](file:///d:/VideCode/WebFifa/frontend/src/components/admin/AdminCsvImportSection.tsx) *(Cập nhật)*: Thêm tab chuyển đổi "Tải File CSV / Excel" vs "Đồng Bộ FC Online (Nexon API)", kèm giao diện nhập SPID, nút combo mẫu, loading spinner và báo cáo kết quả.
3. [`src/pages/AdminTournamentPage.tsx`](file:///d:/VideCode/WebFifa/frontend/src/pages/AdminTournamentPage.tsx) *(Cập nhật)*: Nối `onSyncNexon` vào `AdminCsvImportSection`.

---

## 3. Endpoints API

| Phương thức | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/players/sync-nexon` | `ADMIN` | Đồng bộ danh sách thẻ cầu thủ theo mảng SPID từ FC Online Nexon |

**Payload mẫu**:
```json
{
  "spids": [877020801, 100000488, 100000250]
}
```

---

## 4. Quality Gates & Test Results

- **pytest (unit)**: `102/102 PASSED` (tăng từ 94 lên 102 test).
- **ruff check**: `All checks passed!`
- **mypy --strict**: `Success: no issues found in 51 source files`.
- **import-linter**: `Contracts: 4 kept, 0 broken`.
- **frontend build**: `tsc -b && vite build` $\rightarrow$ `built in 2.53s`, 0 error.

---

## 5. Python Concepts Used

- **`httpx.AsyncClient` & `MockTransport`**: Sử dụng client HTTP bất đồng bộ để gọi API ngoài hiệu năng cao, kết hợp MockTransport để kiểm thử đơn vị độc lập mà không phụ thuộc mạng.
- **Exponential Backoff Retry**: Thuật toán thử lại lũy tiến (`asyncio.sleep(backoff * (2 ** attempt))`) để xử lý lỗi mạng tạm thời hoặc hạn chế tần suất từ máy chủ bên thứ ba.
- **Data Normalization & Adapter Pattern**: Chuyển đổi dữ liệu HTML/JSON tự do của bên thứ ba thành Pydantic Model (`ValidatedPlayerRow`) nghiêm ngặt trước khi đưa vào cơ sở dữ liệu.
- **SQLAlchemy `on_conflict_do_update` (PostgreSQL Upsert)**: Đảm bảo tính lũy thừa (Idempotency) tuyệt đối: chạy đồng bộ nhiều lần không bao giờ sinh ra thẻ trùng lặp, chỉ cập nhật thông tin mới nhất.
