# secret.link

Privacy-first public product: self-destructing encrypted secrets and `@handle` profiles.

**Production domain:** [secretlink.life](https://secretlink.life)

> **Focus now:** public web + API. Teams (B2B), billing, DMs / live / magic-link UI, and deep mobile work are deferred (see [Parked](#parked--not-deployed)).

## Quick Start

```bash
# Install dependencies
pnpm install

# Run public stack in dev
pnpm --filter @secretlink/api-gateway dev    # API on :4000
pnpm --filter @secretlink/web-public dev     # Public app on :3000
pnpm --filter @secretlink/web-admin dev      # Admin on :3002

# Run tests / typecheck (prefer deployable filters in CI)
pnpm --filter @secretlink/api-gateway --filter @secretlink/core test
pnpm typecheck
```

## Monorepo Structure

```
├─ apps/
│  ├─ web-public/          # Remix — public SSR app (deployed)
│  ├─ web-admin/           # Remix — moderation console (deployed)
│  ├─ api-gateway/         # Koa — main HTTPS API (deployed)
│  ├─ mobile/              # Expo React Native (kickoff Aug 2026)
│  ├─ web-teams/           # PARKED — B2B scaffold
│  ├─ mobile-public/       # PARKED — Capacitor shell
│  ├─ mobile-teams/        # PARKED — Capacitor shell
│  ├─ game-runtime/        # PARKED — prototype
│  ├─ moderation-worker/   # PARKED — not on AWS path
│  └─ ai-worker/           # PARKED — not on AWS path
│
├─ packages/
│  ├─ core/                # Domain logic (secrets, flags, profile helpers)
│  ├─ crypto/              # Shared crypto helpers
│  ├─ schemas/             # Zod schemas
│  ├─ ui / ui-public/      # Design system / public tokens
│  ├─ telemetry/           # OpenTelemetry wiring (API)
│  ├─ db/                  # PARKED — Drizzle/Postgres (not live)
│  └─ ui-teams / game-sdk/ # PARKED — Teams-oriented
│
├─ infra/
│  ├─ terraform/           # AWS IAM, S3, SSM, IVS
│  ├─ nginx/               # Reverse proxy config
│  └─ litestream.yml       # SQLite → S3 replication
│
├─ scripts/                # deploy, SSM env, secret rotation
└─ docs/                   # Architecture + ADRs
```

## Tech Stack (production)

| Layer | Choice |
|-------|--------|
| Frontend | Remix v2 + Vite + Tailwind |
| API | Koa 2 (TypeScript) |
| Database | SQLite (`better-sqlite3`) + Litestream → S3 |
| Blobs | S3 (or local `.blobs` in dev) |
| Encryption | Client AES-256-GCM (Web Crypto / noble); server `MASTER_KEY` wraps DEKs at rest |
| Email | Amazon SES |
| Live (flagged off) | Amazon IVS |
| Hosting | AWS EC2 + nginx + PM2 (`eu-north-1`) |
| CI | GitHub Actions (typecheck / lint / test / build for deployable apps) |
| Mobile | Expo (React Native) — not in production deploy yet |

## Architecture Principles

1. **Pure functions** for domain logic — no side effects in `packages/core`
2. **Result types** instead of throws (`neverthrow`)
3. **Schemas first** — Zod at boundaries where adopted
4. **Effects at the edge** — Koa middleware & Remix loaders/actions touch IO
5. **Feature flags** — DMs, live, magic-link stay off until product-ready (`packages/core/src/feature-flags.ts`)

## Deploy

```bash
./scripts/deploy.sh
```

Deploys `api-gateway`, `web-public`, and `web-admin` via rsync + PM2. Secrets come from the server environment / AWS SSM — never commit them.

## Mobile kickoff

See [docs/mobile-v1-kickoff.md](docs/mobile-v1-kickoff.md) for the Expo v1 scope and frozen public API contracts (start of August 2026).

## Parked / not deployed

| Area | Status |
|------|--------|
| Teams (`web-teams`, `ui-teams`) | Scaffold only — no B2B work until public traction |
| Capacitor shells | Empty wrappers — Expo is the mobile path |
| `packages/db` Postgres/Drizzle | Unused; live schema is SQLite in `api-gateway` |
| AI / moderation workers | Mocks; not in deploy path |
| Billing / Pro entitlements | Deferred until significant active users |
| DMs, live, magic-link UI | Backend may exist; UI flags remain `false` |

## License

Proprietary. All rights reserved.
