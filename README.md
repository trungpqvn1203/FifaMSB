# FC Online Player Draft & Tactical Tournament Management System

> **A realtime, multi-team player draft and esports tournament platform built for competitive Vietnamese FC Online tournaments.**

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

---

## 1. System Architecture

```
                                  [ Web Client (React 19 + Vite) ]
                                                │
                                                ▼  (HTTP / Native WebSocket)
                                  [ Nginx Reverse Proxy (:80) ]
                                       │                   │
                     /api/* (REST API) │                   │ /ws/* (Realtime Events)
                                       ▼                   ▼
                               [ FastAPI Backend (Python 3.12) ]
                                 ├── In-Memory Draft & Ban Engine
                                 ├── Background Countdown Timer Loop
                                 └── WebSocket Channel Broadcasters
                                                │
                                                ▼  (asyncpg / SQLAlchemy 2.0)
                                  [ PostgreSQL 16 Database ]
                                 ├── pg_trgm (Fuzzy Player Search)
                                 └── unaccent (Vietnamese Name Search)
```

### Key Design Highlights
- **Layered Architecture**: Strict boundaries enforced by `import-linter` (`api -> service -> domain`; `repository -> domain`). Domain models contain pure business logic with zero framework dependencies.
- **Single-Worker In-Memory Engine (No Redis)**: WebSocket rooms, client connection tracking, and turn countdown timers are handled natively inside the FastAPI application process.
- **Database-Enforced Concurrency**: Pick transactions utilize `SELECT ... FOR UPDATE` with version check to prevent race conditions during simultaneous picks.
- **Zero Celery / Zero Kafka**: Background timers and scheduled auto-picks run via lightweight async tasks in the FastAPI application lifespan.

---

## 2. Quick Start with Docker Compose

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose v2+](https://docs.docker.com/compose/) installed.

### Launching the Stack
1. Clone the repository and navigate to the project root:
   ```bash
   git clone <repo-url> WebFifa
   cd WebFifa
   ```

2. Copy the environment variables:
   ```bash
   cp .env.example .env
   ```

3. Build and launch all containers:
   ```bash
   docker compose up --build -d
   ```

4. Verify running containers:
   ```bash
   docker compose ps
   ```
   - **Frontend & Proxy**: `http://localhost` (Port 80)
   - **Backend REST API**: `http://localhost/api/docs` (Swagger UI)
   - **PostgreSQL**: `localhost:5432`

---

## 3. First-Time Setup & Seeding

### 3.1 Create Initial Admin Account
Run the admin creation CLI inside the backend container or locally:
```bash
# Inside Docker
docker compose exec backend python -m app.auth.create_admin --username admin --password password123

# Locally
cd backend
uv run python -m app.auth.create_admin --username admin --password password123
```

### 3.2 Import Player Card Catalogue (379 Cards)
Populate the database with FC Online seasons and player statistics from CSV:
```bash
# Inside Docker
docker compose exec backend python -m app.importer --file /app/data/sample_players.csv

# Locally
cd backend
uv run python -m app.importer --file ../data/sample_players.csv
```
*Note: You can also upload CSV files directly via the Web UI at `http://localhost/admin/tournaments/new`.*

---

## 4. Local Development Workflow (Without Docker)

### Backend Setup (PowerShell / Windows)
```powershell
cd D:\VideCode\WebFifa\backend

# 1. Install dependencies using uv
uv sync

# 2. Start local Postgres container for development
docker compose -f docker-compose.dev.yml up -d

# 3. Run Alembic database migrations
uv run alembic upgrade head

# 4. Create admin user
uv run python -m app.auth.create_admin --username admin --password password123

# 5. Start development backend server
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend Setup
```powershell
cd D:\VideCode\WebFifa\frontend

# 1. Install npm packages
npm install

# 2. Run development server (Vite with HMR)
npm run dev
```
Open `http://127.0.0.1:5173` in your browser.

---

## 5. Quality Assurance & Testing

All contributions must pass all quality gates before committing:

### Backend Quality Gates
```powershell
cd D:\VideCode\WebFifa\backend

# Fast Ruff linter and formatter check
uv run ruff check .

# Strict static type checking (0 errors across all files)
uv run mypy --strict app

# Architectural layering boundary enforcement
uv run lint-imports

# Unit test suite (94 tests without database dependency)
uv run pytest tests/unit

# Integration test suite (requires Docker testcontainers)
uv run pytest tests/integration
```

### Frontend Quality Gates
```powershell
cd D:\VideCode\WebFifa\frontend

# Linter check
npm run lint

# TypeScript compiler and Vite production build
npm run build
```

---

## 6. Production Operations & Hardening

### 6.1 The Single-Worker Constraint (`--workers 1`)
> [!IMPORTANT]
> **Why `--workers 1` is mandatory:**
> This platform is engineered to operate without external message brokers (such as Redis or RabbitMQ). All WebSocket subscriber connection pools and the draft countdown background timer run as stateful async tasks inside the Python process.
> 
> Running Uvicorn with multiple workers (`--workers > 1`) will cause memory isolation between workers:
> - Client A connected to Worker 1 will not receive broadcast messages dispatched by Worker 2.
> - Multiple competing timer tasks could attempt to process turn expiration simultaneously.
> 
> If horizontal multi-server scaling is required in the future, a Redis pub/sub broker layer (`DraftBroadcaster` implementation) must be introduced first. For single-server deployments (up to thousands of concurrent viewers), 1 worker handles tens of thousands of requests per second asynchronously.

### 6.2 Database Backups & Restore
#### Backup
```bash
docker exec -t webfifa_postgres pg_dump -U postgres -d webfifa -Fc > backup_$(date +%Y%m%d_%H%M%S).dump
```

#### Restore
```bash
docker exec -i webfifa_postgres pg_restore -U postgres -d webfifa --clean --if-exists < backup_file.dump
```

### 6.3 HTTPS / TLS Termination
When deploying to a public domain (e.g. `tournament.example.com`):
1. Use an edge reverse proxy (such as Cloudflare, Traefik, or Caddy) in front of Port 80 to terminate TLS.
2. Ensure WebSocket upgrade headers are passed transparently:
   ```nginx
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   proxy_read_timeout 3600s;
   ```
3. Update `CORS_ORIGINS` in `.env` to match your HTTPS domain.

---

## 7. License & Credits

Built for the Vietnamese FC Online esports community.
Licensed under the [MIT License](LICENSE).
