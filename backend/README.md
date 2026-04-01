# Etut API

FastAPI backend for the Etut education platform.

## Setup

```bash
uv sync
cp .env.example .env
```

## Development

```bash
uv run uvicorn app.main:app --reload
```

## Code Quality

```bash
uv run ruff check .          # Lint
uv run ruff format .         # Format
uv run mypy app/             # Type check
uv run pytest                # Tests
uv run pre-commit run --all-files  # All checks
```
