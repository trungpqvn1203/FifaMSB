# Bug Fix Log — FIFA / FC Online Draft System

> **Mục đích**: Index tất cả các lỗi đã phát hiện và sửa trong quá trình phát triển / vận hành.
> Khi debug, đọc file này trước để tránh mất công điều tra lại lỗi đã từng gặp.

## Format mỗi entry

```markdown
### [YYYY-MM-DD] <Mô tả ngắn>
- **Triệu chứng**: Hiện tượng gì xảy ra?
- **Nguyên nhân gốc (Root Cause)**: Tại sao?
- **Các file đã sửa**: `path/to/file.py`
- **Cách xử lý**: Giải thích ngắn gọn cách fix.
- **Test xác nhận**: Test nào đã pass sau fix.
- **Chi tiết**: [link tới file bug nếu có]
```

---

## Danh sách Bug Fixes

| Ngày | Mô tả | Phase liên quan | File chi tiết |
|------|-------|-----------------|---------------|
| 2026-10-01 | Cookie `Secure` flag lỗi khi deploy HTTP | Phase 2 - Auth | [2026-10-01-cookie-secure.md](2026-10-01-cookie-secure.md) |
| 2026-10-06 | Nút thêm đội bị ẩn sau khi giải có 2 đội (`READY`) | Phase 4 & 7 - UI | [2026-10-06-them-doi-giai-dau.md](2026-10-06-them-doi-giai-dau.md) |
| 2026-10-08 | Liên kết đội trưởng ngoài trang giải & Nginx SPA cache | Phase 4, 7 & 12 | [2026-10-08-lien-ket-doi-truong-va-cache-nginx.md](2026-10-08-lien-ket-doi-truong-va-cache-nginx.md) |
| 2026-10-08 | Lỗi đảo thứ tự Draft & Nâng cấp Kéo Thả (Drag & Drop) | Phase 4, 5 & 11 | [2026-10-08-draft-order-reorder-drag-drop.md](2026-10-08-draft-order-reorder-drag-drop.md) |
| 2026-10-08 | Khóa thay đổi thứ tự khi đang cấm chọn / giải đấu chạy | Phase 4, 5, 9 & 11 | [2026-10-08-khoa-thu-tu-khi-cam-chon.md](2026-10-08-khoa-thu-tu-khi-cam-chon.md) |

---

> **Hướng dẫn thêm bug mới**: Tạo file `docs/bugs/YYYY-MM-DD-<ten-loi>.md` rồi thêm 1 dòng vào bảng trên.
