## 4. Player Data Import Architecture

### 4.1 Overview

Player data is batch-imported from a **CSV** file via the admin endpoint or CLI.

**CSV Columns:**
`external_player_id, name, season_code, position, salary, rating, image_url`
*(rating and image_url are optional/nullable).*

**Import pipeline — three stages (module `app/importer/`):**

1. **Extract**: stream the CSV in chunks (`pandas chunksize` or `csv` module), never load the entire file into memory.
2. **Transform**: pure functions:
   - `Position`: original position string stored without collapsing (e.g. `ST, CF, LW, RW, CAM, CM, CDM, LM, RM, CB, LB, RB, LWB, RWB, GK`).
   - `Salary`: read directly from CSV column `salary`. `SalaryMapper` is an optional fallback only if salary is missing.
   - `Season`: if `season_code` does not exist in `seasons` table, automatically insert a new `Season` row (`code = season_code, name = season_code`).
   - Row validation with Pydantic v2: `externalPlayerId` is REQUIRED; rows without it are skipped and reported. No fuzzy name matching. Salary must be an integer >= 1.
3. **Load**: batch upsert (`INSERT … ON CONFLICT DO UPDATE`) into `players`, `seasons`, and `player_seasons`. Idempotent — importing the same file twice must not create duplicates. Returns an import report: `{rowsRead, inserted, updated, skipped, errors}`.

**Available as:**
- CLI: `uv run python -m app.importer --file players.csv`
- Admin HTTP endpoint: `POST /api/admin/players/import` (multipart/form-data: `file`)

### 4.2 Deduplication & Salary Update Strategy

| Step                             | Logic                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Match by `externalPlayerId`**  | `externalPlayerId` is REQUIRED. Used as primary and unique key for matching/creating master `Player`.                       |
| **Missing `externalPlayerId`**   | If a row lacks `externalPlayerId`, it is skipped and counted in the import report (`skipped` / `errors`).                    |
| **No fuzzy matching**            | Deduplication relies strictly and reliably on `externalPlayerId`.                                                           |
| **PlayerSeason upsert**          | On re-import of same `(player_id, season_id)`, update salary, position, rating, imageUrl. Do not create duplicate.         |
| **Pool lock protection**         | CSV re-import and salary PATCH are rejected with `POOL_LOCKED` (422) if any draft session is `PICKING` or `PAUSED`.          |

### 4.3 Offline Salary Calibration Tool (`docs/tools/calibrate_salary.py`)

When raw CSV exports lack salary data or require tier-based re-balancing against player ratings (OVR), the standalone developer script `docs/tools/calibrate_salary.py` can be executed offline to compute and populate synthetic salaries (using rating tiers or an exponential power curve) before importing into the backend:

```powershell
python docs/tools/calibrate_salary.py --input raw_players.csv --output players_with_salaries.csv --min-salary 5 --max-salary 60
```

> **Note:** This tool is an offline utility located in `docs/tools/` and is **not part of the backend runtime**.

### 4.4 Domain Isolation Principle

The domain (`DraftService`, `MatchService`) must never depend directly on the import adapter:

```
❌ DraftService → CsvImporter
❌ MatchService → ExternalApiClient

✅ External Source → ImportAdapter → ImportService → player_seasons table
✅ DraftService     → player_seasons table (read-only for domain)
```

---

