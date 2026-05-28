# Claria

AI-powered medical note assistant for doctors. Records doctor–patient conversations, transcribes them with Whisper, and generates structured clinical notes (SOAP, summary, structured data) with GPT-4o.

## Status

Early development. Vertical-slice MVP in progress: sign-in → record → transcribe → generate notes → display results.

## Tech stack

| Layer          | Choice                                                      |
| -------------- | ----------------------------------------------------------- |
| Frontend       | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend        | FastAPI + SQLAlchemy 2.0 (async) + Alembic                  |
| Database       | PostgreSQL (Neon)                                           |
| Auth           | Clerk                                                       |
| Object storage | Cloudflare R2                                               |
| AI             | OpenAI Whisper API + GPT-4o                                 |
| Deployment     | Vercel (web) · Railway (api) · Neon (db)                    |

## Layout

```
claria/
├── apps/
│   ├── api/                 FastAPI backend
│   └── web/                 Next.js 15 frontend
├── packages/
│   └── shared-types/        TS types generated from FastAPI's OpenAPI schema
├── docker-compose.dev.yml   Local Postgres (optional alternative to Neon)
├── turbo.json               Task pipeline
├── pnpm-workspace.yaml      Workspaces
└── package.json
```

## Prerequisites

- Node `>= 20` (matches `.nvmrc`)
- pnpm `>= 9`
- Python `3.12`
- [`uv`](https://docs.astral.sh/uv/) for Python dependency management
- Docker (optional, only for local Postgres via `docker-compose.dev.yml`)

## Getting started

```bash
# Install JS dependencies for all workspaces
pnpm install

# Run web + api together
pnpm dev

# Or one at a time
pnpm --filter @claria/web dev
pnpm --filter @claria/api dev
```

Each app owns its own environment configuration:

- `apps/api/.env` — copy from `apps/api/.env.example`
- `apps/web/.env.local` — copy from `apps/web/.env.example`

See each app's `README.md` for setup details and required environment variables.

## Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `pnpm dev`          | Start all apps in development     |
| `pnpm build`        | Build all apps                    |
| `pnpm lint`         | Lint all workspaces               |
| `pnpm typecheck`    | Type-check all workspaces         |
| `pnpm test`         | Run all tests                     |
| `pnpm format`       | Format the repo with Prettier     |
| `pnpm format:check` | Verify formatting without writing |

## Workflow

`apps/api` exposes an OpenAPI schema that `packages/shared-types` consumes to generate TypeScript types. Backend route changes ripple to the frontend at compile time — regenerate with `pnpm --filter @claria/shared-types generate` once that package is in place.
