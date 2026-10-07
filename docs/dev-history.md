# Development History Index — FIFA / FC Online Player Draft

> **Mục đích**: Index nhẹ để AI load nhanh trạng thái dự án. Chi tiết từng phase đọc ở `docs/history/`. Bug fixes đọc ở `docs/bugs/`.

---

## 📌 Bảng tổng hợp trạng thái các Phase

| Phase | Tên giai đoạn | Trạng thái | Số test | Chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0 & 0.5** | Architecture, Design & UI Tokens/Gaps | **Hoàn thành** | - | `docs/design/` |
| **Phase 1** | Base Infra, DB & Alembic Migrations | **Hoàn thành** | 12/12 | [phase-1-infra.md](history/phase-1-infra.md) |
| **Phase 2** | Authentication & User Management | **Hoàn thành** | 53/53 | [phase-2-auth.md](history/phase-2-auth.md) |
| **Phase 3** | Seasons, Player Catalogue & Importer Pipeline | **Hoàn thành** | 74/74 | [phase-3-player.md](history/phase-3-player.md) |
| **Phase 4** | Tournaments, Rules (JSONB) & Teams | **Hoàn thành** | 112/112 | [phase-4-tournament.md](history/phase-4-tournament.md) |
| **Phase 5** | Draft Engine Core | **Hoàn thành** | 137/137 | [phase-5-draft-engine.md](history/phase-5-draft-engine.md) |
| **Phase 6** | Draft Timer Background Task & WebSocket Realtime | **Hoàn thành** | 156/156 | [phase-6-websocket.md](history/phase-6-websocket.md) |
| **Phase 7** | Frontend Foundation (React + Vite + Tailwind) | **Hoàn thành** | Build PASS | [phase-7-frontend.md](history/phase-7-frontend.md) |
| **Phase 8** | Draft Board UI & WebSocket Hook | **Hoàn thành** | Build PASS, 157/157 | [phase-8-draft-board.md](history/phase-8-draft-board.md) |
| **Phase 9** | Matches & Tactical Bans (backend) | **Hoàn thành** | 169/169 | [phase-9-matches.md](history/phase-9-matches.md) |
| **Phase 10** | Ban UI | *Chờ thực hiện* | - | - |
| **Phase 11** | Admin UI | *Chờ thực hiện* | - | - |
| **Phase 12** | E2E, Docker & Hardening | *Chờ thực hiện* | - | - |

---

## 🐛 Bug Fix Log

Xem tất cả lỗi đã gặp và cách fix tại: [docs/bugs/README.md](bugs/README.md)

---

## 📚 Tổng kết kiến thức Python quan trọng

> Các khái niệm Python/TypeScript đã dùng được ghi trong từng file phase tương ứng.
> Tham khảo nhanh: Phase 5 (locking, versioning), Phase 6 (WebSocket, asyncio), Phase 8 (time sync, version gap), Phase 9 (optional DI, view projection).
