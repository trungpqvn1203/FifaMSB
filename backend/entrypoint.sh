#!/bin/sh
set -e

echo "[WebFifa] Running database migrations..."
alembic upgrade head

echo "[WebFifa] Starting Uvicorn with 1 worker (single-worker in-memory draft engine)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
