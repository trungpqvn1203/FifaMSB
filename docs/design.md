# FIFA / FC Online Player Draft System — Design Document (Phase 0 Revision 4)

> **Status**: Revised for Vietnamese FC Online pro tournament draft system.
> **Source of truth**: `AGENTS.md` (Revision 4) + `docs/ui/reference-draft-board.png`
> **Changelog**: See `docs/CHANGELOG.md` for full revision history.
>
> ⚠️ Nội dung chi tiết đã được tách vào `docs/design/`. File này là **index/TOC**.
> Khi AI cần tra cứu một phần cụ thể, đọc **đúng file con** thay vì toàn bộ file này.

---

## Tổng quan hệ thống

Hệ thống draft cầu thủ realtime cho giải đấu FC Online Việt Nam:
- N đội (không hard-code 4), mỗi đội chọn lần lượt theo turn
- Mỗi pick là 1 `PlayerSeason` (thẻ cầu thủ mùa cụ thể) từ pool nhiều mùa
- Giới hạn ngân sách, roster size, uniqueBy PLAYER/CARD
- Timer tự động: AutoPickCheapest (default) hoặc SkipTurn
- WebSocket realtime: snapshot đầy đủ sau mỗi thay đổi

---

## Sections — đọc file tương ứng theo nhu cầu

| # | File | Nội dung | Kích thước |
|---|------|----------|------------|
| 1 | [`docs/design/01-domain-analysis.md`](./design/01-domain-analysis.md) | Entities chi tiết, fields, constraints | ~7 KB |
| 2 | [`docs/design/02-erd.md`](./design/02-erd.md) | Entity-Relationship Diagram (ERD) | ~7.5 KB |
| 3 | [`docs/design/03-draft-state-machine.md`](./design/03-draft-state-machine.md) | Draft state machine, transitions | ~4.5 KB |
| 4 | [`docs/design/04-import-architecture.md`](./design/04-import-architecture.md) | ETL pipeline architecture | ~3.8 KB |
| 5 | [`docs/design/05-business-rules.md`](./design/05-business-rules.md) | BR-P01..BR-P16, BR-T01..BR-TM, BR-SEC | ~13 KB |
| 6 | [`docs/design/06-api-spec.md`](./design/06-api-spec.md) | Tất cả API endpoints + request/response examples | ~16.5 KB |
| 7 | [`docs/design/07-decisions.md`](./design/07-decisions.md) | Unchanged design decisions | ~0.7 KB |
| 8 | [`docs/design/08-open-questions.md`](./design/08-open-questions.md) | OQ-1..OQ-13 (all decided) | ~6 KB |

---

## Khi nào đọc file nào

- **Bắt đầu Phase 4** (Tournament/Teams): đọc `01-domain-analysis.md` + `05-business-rules.md` + `06-api-spec.md`
- **Bắt đầu Phase 5** (Draft Engine): đọc `03-draft-state-machine.md` + `05-business-rules.md`
- **Debug pick logic**: đọc `05-business-rules.md` (BR-P01..P16)
- **Kiểm tra API shape**: đọc `06-api-spec.md`
- **Kiểm tra schema DB**: đọc `02-erd.md`
- **Tra cứu import ETL**: đọc `04-import-architecture.md`
