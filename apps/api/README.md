# @claria/api

FastAPI backend for Claria. Async-first, layered architecture, structured logging, Railway-ready Docker.

## Setup

```bash
# Python deps (run from this directory)
uv sync

# Copy env template and edit at minimum DATABASE_URL
cp .env.example .env
```

You have two options for the database:

1. **Neon** — create a branch, paste the connection string (with `+asyncpg`) into `.env`.
2. **Docker** — from the repo root, `docker compose -f docker-compose.dev.yml up -d`. The `.env.example` default already points at this.

## Run

```bash
# From repo root (preferred — uses Turborepo)
pnpm --filter api dev

# Or directly
uv run uvicorn app.main:app --reload
```

API is at <http://localhost:8000>.

- Health: `GET /api/v1/health`
- OpenAPI docs: <http://localhost:8000/docs>

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter api dev` | Start with hot reload on port 8000 |
| `pnpm --filter api start` | Start without reload |
| `pnpm --filter api lint` | Ruff lint |
| `pnpm --filter api lint:fix` | Ruff lint with auto-fixes |
| `pnpm --filter api format` | Ruff format |
| `pnpm --filter api typecheck` | mypy |
| `pnpm --filter api test` | pytest |

## Layout

```
apps/api/
├── app/
│   ├── main.py              FastAPI factory + middleware + lifespan
│   ├── core/
│   │   ├── config.py        pydantic-settings (env validation)
│   │   ├── logging.py       structlog setup (JSON in prod, console in dev)
│   │   └── exceptions.py    AppError hierarchy
│   ├── db/
│   │   ├── base.py          SQLAlchemy DeclarativeBase + naming conventions
│   │   ├── session.py       async engine + session factory + get_session dep
│   │   └── models/          ORM models (populated in Step 5)
│   ├── api/
│   │   ├── deps.py          DbSession dependency alias
│   │   ├── errors.py        Exception handlers (AppError → JSON)
│   │   └── v1/
│   │       ├── router.py    Mounts v1 routers
│   │       └── health.py    GET /api/v1/health
│   ├── schemas/
│   │   └── common.py        BaseSchema (camelCase aliases) + ErrorResponse
│   ├── services/            Business logic (Step 6+)
│   ├── repositories/        Data access (Step 5+)
│   ├── integrations/        SDK wrappers — Clerk, OpenAI, R2 (Step 4+)
│   ├── workers/             Background tasks (Step 7+)
│   └── prompts/             LLM prompts (Step 9)
├── tests/
│   ├── conftest.py
│   ├── fixtures/sample_consultation.mp3
│   └── unit/api/test_health.py
├── Dockerfile               Multi-stage; production build for Railway
├── pyproject.toml           uv, ruff, mypy, pytest config
└── .env.example
```

## Architectural conventions

- **`api → services → repositories → db`.** HTTP code never touches the ORM directly.
- **Services are async module-level functions** with explicit dependencies passed in. No service classes, no global singletons.
- **`integrations/` is the only place** that imports third-party SDKs. Services call integrations, never the SDK.
- **`workers/` opens fresh DB sessions** — never reuses a request session.
- **Domain errors** are subclasses of `AppError`. HTTP mapping happens in `api/errors.py`.
- **JSON wire format is camelCase**; Python stays snake_case (Pydantic `alias_generator=to_camel`).
