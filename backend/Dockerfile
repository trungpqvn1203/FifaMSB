# ==============================================================================
# Stage 1: Build & dependency installation using uv
# ==============================================================================
FROM ghcr.io/astral-sh/uv:0.5.21 AS uv
FROM python:3.12-slim-bookworm AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy uv binaries
COPY --from=uv /uv /uvx /bin/

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY pyproject.toml uv.lock ./

# Install production dependencies only
RUN uv sync --frozen --no-dev --no-install-project

# ==============================================================================
# Stage 2: Runtime image
# ==============================================================================
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Copy migration configuration and scripts
COPY alembic.ini ./
COPY alembic/ ./alembic/

# Copy application source code
COPY app/ ./app/

# Copy entrypoint script
COPY entrypoint.sh ./
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

# Expose backend port
EXPOSE 8000

# Run entrypoint (database migration + single-worker uvicorn)
ENTRYPOINT ["./entrypoint.sh"]
