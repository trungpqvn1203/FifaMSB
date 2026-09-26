# Quick Reference — Domain Entities & API Endpoints

> Bảng tra nhanh. Chi tiết đầy đủ: `docs/design/01-domain-analysis.md` (entities) và `docs/design/06-api-spec.md` (API).

---

## Domain Entities (tóm tắt)

| Entity | Key Fields | Constraints đáng nhớ |
|--------|-----------|----------------------|
| `Season` | id, code, name, badge_url, game, year | UNIQUE(code) |
| `Player` | id, name, external_player_id | UNIQUE(external_player_id) |
| `PlayerSeason` | id, player_id, season_id, position, salary INT, rating?, image_url?, status[ACTIVE,INACTIVE] | UNIQUE(player_id, season_id) |
| `Tournament` | id, name, status[DRAFT,READY,RUNNING,COMPLETED,CANCELLED], rules jsonb | — |
| `Team` | id, tournament_id, name, draft_order, budget_used, status | UNIQUE(tournament_id, draft_order), CHECK(budget_used >= 0) |
| `DraftSession` | id, tournament_id, status[WAITING,PICKING,PAUSED,COMPLETED,CANCELLED], current_round, current_turn, current_team_id, turn_started_at, turn_expires_at, remaining_millis, rules_snapshot, version | Partial UNIQUE(tournament_id) WHERE status IN ('WAITING','PICKING','PAUSED') |
| `DraftPick` | id, draft_session_id, team_id, player_season_id, player_id, unique_by_player bool, round, turn_number, salary_at_pick | UNIQUE(session, player_season); partial UNIQUE(session, player_id) WHERE unique_by_player; UNIQUE(session, turn_number) |
| `DraftEvent` | id, draft_session_id, type[START,PICK,SKIP,PAUSE,RESUME,COMPLETE,CANCEL], team_id, turn_number, payload jsonb | Append-only |
| `Match` | id, tournament_id, home_team_id, away_team_id, status[SCHEDULED,BAN_PHASE,BANS_LOCKED,COMPLETED], rules_snapshot, ban_started_at, ban_expires_at, home_confirmed, away_confirmed, version | — |
| `MatchBan` | id, match_id, banning_team_id, target_team_id, player_season_id | UNIQUE(match_id, banning_team_id, player_season_id) |
| `User` | id, username, password_hash, role[ADMIN,TEAM_USER], team_id? | — |
| `Session` | id (random token), user_id, expires_at | — |

### TournamentRules (JSONB, Pydantic validated)

| Field | Type | Default |
|-------|------|---------|
| rules_version | int | — |
| rosterSize | int (1..60) | 24 |
| budget | int | 305 |
| pickTimeSeconds | int | 30 |
| uniqueBy | PLAYER \| CARD | PLAYER |
| timeoutPolicy | SKIP_TURN \| AUTO_PICK_CHEAPEST | AUTO_PICK_CHEAPEST |
| allowedSeasonIds | list[UUID] | [] (= all seasons) |
| banCount | int | 5 |
| banTimeSeconds | int | 60 |
| banTarget | OPPONENT_ROSTER \| OWN_ROSTER | OPPONENT_ROSTER |
| banOrder | SIMULTANEOUS \| ALTERNATING | SIMULTANEOUS |

### Positions FC Online (15 gốc, không collapse)

`ST CF LW RW CAM CM CDM LM RM CB LB RB LWB RWB GK`
Group: FW={ST,CF,LW,RW} · MF={CAM,CM,CDM,LM,RM} · DF={CB,LB,RB,LWB,RWB} · GK={GK}

---

## Error Codes → HTTP Status

| Code | HTTP | Khi nào |
|------|------|---------|
| DRAFT_NOT_FOUND | 404 | Draft không tồn tại |
| DRAFT_NOT_ACTIVE | 422 | Draft không ở trạng thái PICKING |
| NOT_YOUR_TURN | 403 | Team không phải lượt hiện tại |
| PLAYER_NOT_FOUND | 404 | PlayerSeason không tồn tại |
| PLAYER_NOT_AVAILABLE | 422 | PlayerSeason status=INACTIVE |
| PLAYER_ALREADY_PICKED | 409 | Đã được chọn trong draft này |
| SEASON_NOT_ALLOWED | 422 | Season không trong allowedSeasonIds |
| BUDGET_EXCEEDED | 422 | budgetUsed + salary > budget |
| BUDGET_INSUFFICIENT_FOR_ROSTER | 422 | Không đủ budget cho các slot còn lại |
| TEAM_ROSTER_FULL | 422 | Team đã đủ rosterSize |
| DRAFT_COMPLETED | 422 | Draft đã hoàn thành |
| TURN_EXPIRED | 422 | Lượt đã hết giờ (timeout xử lý trước) |
| DRAFT_POOL_TOO_SMALL | 422 | Pool không đủ cards cho draft start |
| MATCH_NOT_FOUND | 404 | — |
| MATCH_NOT_ACTIVE | 422 | Match không ở BAN_PHASE |
| PLAYER_NOT_IN_ROSTER | 422 | Player không trong roster đội mục tiêu |
| BAN_LIMIT_REACHED | 422 | Đã ban đủ banCount |
| BANS_ALREADY_CONFIRMED | 422 | Đội đã confirm, không sửa được |
| BANS_LOCKED | 422 | Ban phase đã lock |
| POOL_LOCKED | 422 | Draft đang PICKING/PAUSED, không import/đổi lương |

---

## API Endpoints (tóm tắt)

### Auth
| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/login` | Public | Login → set cookie |
| POST | `/api/auth/logout` | Auth | Xóa session |
| GET | `/api/auth/me` | Auth | User hiện tại |
| POST | `/api/admin/users` | ADMIN | Tạo TEAM_USER |

### Seasons & Players
| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET/POST | `/api/seasons` | Auth/ADMIN | List / tạo season |
| GET | `/api/player-seasons` | Auth | Phân trang, filter, search |
| GET | `/api/player-seasons/{id}` | Auth | Chi tiết card |
| PATCH | `/api/admin/player-seasons/{id}` | ADMIN | Đổi salary (bị POOL_LOCKED) |
| POST | `/api/admin/players/import` | ADMIN | Upload CSV (bị POOL_LOCKED) |

### Tournaments & Teams
| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET/POST | `/api/tournaments` | Auth/ADMIN | List / tạo tournament |
| GET | `/api/tournaments/{id}` | Auth | Chi tiết + draftId + teams |
| POST | `/api/tournaments/{id}/complete` | ADMIN | Đánh dấu COMPLETED |
| GET/POST | `/api/tournaments/{id}/teams` | Auth/ADMIN | List / thêm team |
| GET | `/api/teams/{id}/roster` | Auth | Danh sách đã draft |

### Draft
| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| POST | `/api/tournaments/{id}/draft/start` | ADMIN | Bắt đầu draft |
| GET | `/api/drafts/{id}` | Auth | Trạng thái draft |
| GET | `/api/drafts/{id}/picks` | Auth | Danh sách picks |
| POST | `/api/drafts/{id}/picks` | TEAM_USER | Chọn card (`{playerSeasonId, expectedVersion}`) |
| POST | `/api/drafts/{id}/pause` | ADMIN | Tạm dừng |
| POST | `/api/drafts/{id}/resume` | ADMIN | Tiếp tục |
| POST | `/api/drafts/{id}/cancel` | ADMIN | Hủy → tournament về READY |

### Matches & Bans
| Method | Path | Role | Mô tả |
|--------|------|------|-------|
| GET/POST | `/api/tournaments/{id}/matches` | Auth/ADMIN | List / tạo match |
| GET | `/api/matches/{id}` | Auth | Chi tiết match |
| POST | `/api/matches/{id}/bans/start` | ADMIN | Bắt đầu ban phase |
| POST | `/api/matches/{id}/bans` | TEAM_USER | Thêm ban |
| DELETE | `/api/matches/{id}/bans/{banId}` | TEAM_USER | Xóa ban |
| POST | `/api/matches/{id}/bans/confirm` | TEAM_USER | Confirm bans |
| POST | `/api/matches/{id}/complete` | ADMIN | Hoàn thành match |

### WebSocket
- `/ws/drafts/{draft_id}` — full DraftState snapshot sau mỗi thay đổi
- `/ws/matches/{match_id}` — full MatchState snapshot (ban ẩn đến khi lock)
