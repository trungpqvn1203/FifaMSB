# [2026-10-01] Cookie `Secure` Flag Lỗi Khi Deploy HTTP

## Triệu chứng
- Sau khi deploy lên server (IP công khai `http://20.205.138.198`), đăng nhập thành công (backend trả 200) nhưng cookie `session_token` **không được trình duyệt lưu**.
- Mọi request sau đó đều bị 401 Unauthorized vì không có cookie.
- Môi trường local (`http://localhost`) hoạt động bình thường.

## Nguyên nhân gốc (Root Cause)
- Cookie được set với cờ `Secure=True` cứng trong code.
- Theo chuẩn HTTP, trình duyệt **từ chối lưu cookie có `Secure=True`** nếu kết nối không phải HTTPS.
- Server đang chạy HTTP thuần (chưa có SSL/TLS), do đó cookie bị drop ngay ở phía trình duyệt.

## Các file đã sửa
- `backend/app/auth/service.py` — hàm `login()`, chỗ set cookie response
- `backend/app/config.py` — thêm biến `COOKIE_SECURE: bool`
- `backend/docker-compose.yml` (hoặc `.env`) — thêm `COOKIE_SECURE=false` cho môi trường HTTP

## Cách xử lý
```python
# Trước (hardcoded)
response.set_cookie(
    key="session_token",
    value=token,
    httponly=True,
    secure=True,          # ← luôn True, vỡ khi HTTP
    samesite="lax",
)

# Sau (đọc từ config)
response.set_cookie(
    key="session_token",
    value=token,
    httponly=True,
    secure=settings.COOKIE_SECURE,   # ← True trên HTTPS, False trên HTTP
    samesite="lax",
)
```

```python
# backend/app/config.py
class Settings(BaseSettings):
    COOKIE_SECURE: bool = True   # default True (production HTTPS)
```

```env
# .env cho môi trường HTTP / dev server
COOKIE_SECURE=false
```

## Test xác nhận
- Đăng nhập thủ công trên `http://20.205.138.198` → cookie được lưu thành công.
- `GET /api/auth/me` trả về thông tin user đúng sau login.
- Không có regression trên môi trường local.

## Bài học
> Không bao giờ hardcode security flags. Mọi config liên quan đến môi trường (Secure, CORS origins, Debug mode) đều phải đọc từ `pydantic-settings` / biến môi trường.
