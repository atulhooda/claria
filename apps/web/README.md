# @claria/web

Claria's Next.js 15 frontend (App Router, TypeScript strict, Tailwind + shadcn/ui).

## Layout

```
src/
├── app/                Routes — server-first. (auth) and (dashboard) route groups.
├── components/
│   ├── ui/             shadcn primitives (button, card, skeleton)
│   ├── layout/         sidebar, topnav, brand, theme-toggle
│   ├── consultation/   feature components
│   └── providers.tsx   single client boundary for TanStack Query + theme
├── config/             site metadata, navigation manifest
├── lib/
│   ├── api/            typed fetch wrappers (components NEVER call fetch directly)
│   ├── env.ts          zod-validated NEXT_PUBLIC_* / server env
│   ├── query-client.ts QueryClient factory (per-request on server, singleton on client)
│   └── utils.ts        cn() helper
└── types/api.ts        future re-export point for @claria/shared-types
```

Naming: TS files `kebab-case.tsx`, components `PascalCase`. App Router conventions
(`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`) are reserved.

## Getting started

```bash
# from the repo root
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @claria/web dev
```

The app boots at <http://localhost:3000>. The FastAPI backend (`apps/api`) is expected at
<http://localhost:8000/api/v1>; override with `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

## Environment

| Variable | Required | Default | Purpose |
| --- | :-: | --- | --- |
| `NEXT_PUBLIC_APP_ENV` | yes | `development` | Surfaces in Sentry tags / devtools gating |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3000` | Used in metadata and absolute URLs |
| `NEXT_PUBLIC_API_BASE_URL` | yes | `http://localhost:8000/api/v1` | Browser-side API base URL |
| `API_BASE_URL_INTERNAL` | no | unset | Server-only override for RSC fetches |

All `NEXT_PUBLIC_*` values are validated against a zod schema at module load — invalid
or missing values cause an immediate, descriptive error rather than silent runtime failure.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next dev server with HMR on port 3000 |
| `pnpm build` | Production build (`.next/`) |
| `pnpm start` | Run the production build |
| `pnpm lint` | `next lint` (ESLint with the project ruleset) |
| `pnpm typecheck` | Strict `tsc --noEmit` |

## Adding shadcn primitives

`components.json` is configured for the `new-york` style with `slate` base color and
CSS variables. Add new primitives the standard way:

```bash
pnpm dlx shadcn@latest add dialog dropdown-menu input
```

They drop into `src/components/ui/` and use the existing theme tokens automatically.

## API integration contract

- Every HTTP call goes through `lib/api/client.ts` — components never call `fetch`.
- The client injects an `x-request-id` header that the FastAPI middleware echoes back,
  giving end-to-end tracing without extra wiring.
- API DTOs live in `src/types/api.ts`. When `packages/shared-types` lands (generated
  from FastAPI's OpenAPI), this file collapses to a single re-export.

## Architecture rules (enforced socially, not by lint — yet)

1. Server components by default. `"use client"` only where you need state, effects, or
   browser APIs.
2. No HTTP calls outside `lib/api/`.
3. No prop-drilling for cross-cutting concerns — use `providers.tsx` or TanStack Query.
4. No business logic inside `components/ui/`. Those are pure shadcn primitives.
5. Every new file fits in an existing folder. New top-level folders need a design note.
