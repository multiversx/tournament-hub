# syntax=docker/dockerfile:1

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# Install runtime tools and temporary build deps; then clean up build deps
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libssl3 \
    libffi8 \
    build-essential \
    gcc \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching)
COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential gcc libffi-dev libssl-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy application source
COPY . .

# Create and use a non-root user (recommended for Kubernetes)
RUN groupadd -r app && useradd -r -g app app \
    && chown -R app:app /app
USER app:app

EXPOSE 8000

# Basic liveness/readiness check against FastAPI's OpenAPI endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/openapi.json > /dev/null || exit 1

# IMPORTANT: keep a single worker because the app starts background threads on import
# Optional ROOT_PATH is honored if provided (useful when served under a subpath like /tournament-hub)
ENV ROOT_PATH=""
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers ${ROOT_PATH:+--root-path ${ROOT_PATH}} --log-level info"]


