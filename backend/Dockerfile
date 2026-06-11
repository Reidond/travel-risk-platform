# Backend image for the travel-risk-platform API.
#
# IMPORTANT: build context must be the REPOSITORY ROOT, because the backend is
# a uv workspace member that depends on the `core` member (tourism-risk):
#
#   docker build -f backend/Dockerfile .
#
# (docker-compose.yml does this automatically.)
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Layer 1: third-party dependencies only (cached until the lockfile changes).
# The member pyprojects must be present for uv to resolve the workspace.
COPY pyproject.toml uv.lock ./
COPY core/pyproject.toml core/pyproject.toml
COPY backend/pyproject.toml backend/pyproject.toml
RUN uv sync --frozen --no-dev --no-install-workspace --package travel-risk-api

# Layer 2: workspace sources (installed editable; `app` resolves assets
# relative to backend/, so the source tree stays in the image).
COPY core/ core/
COPY backend/ backend/
RUN uv sync --frozen --no-dev --package travel-risk-api

ENV PATH="/app/.venv/bin:$PATH" \
    DATABASE_URL="sqlite:////app/data/app.db"

# SQLite database lives here; mounted as a named volume in docker-compose.
VOLUME /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
