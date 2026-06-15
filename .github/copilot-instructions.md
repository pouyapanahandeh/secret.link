# Secret.link — Project Skill

> One brand. Two products. One monorepo. One GCP project.

## Monorepo Overview

- **Package manager**: pnpm 9.15.4 (workspaces)
- **Task runner**: Turborepo
- **Node**: ≥ 20
- **Workspace layout**: `apps/*` and `packages/*`

## Apps

| App | Path | Stack | Port |
|-----|------|-------|------|
| `web-public` | `apps/web-public` | Remix v2 + Vite + React 18 + Tailwind v4, PWA | 3000 |
| `web-teams` | `apps/web-teams` | Remix v2 + Vite (marketing placeholder) | 3001 |
| `api-gateway` | `apps/api-gateway` | Koa 2 + better-sqlite3, JWT auth | 4000 |
| `mobile` | `apps/mobile` | Expo SDK 54, React Native 0.81, expo-router | — |
| `mobile-public` | `apps/mobile-public` | Expo (public-facing, early) | — |
| `mobile-teams` | `apps/mobile-teams` | Expo (teams, early) | — |
| `game-runtime` | `apps/game-runtime` | Sandboxed game module executor | 4002 |
| `ai-worker` | `apps/ai-worker` | Pub/Sub consumer — Vertex AI | — |
| `moderation-worker` | `apps/moderation-worker` | Pub/Sub consumer — content moderation | — |

## Shared Packages

| Package | Purpose |
|---------|---------|
| `packages/core` | Pure domain logic (no side effects), uses `neverthrow` |
| `packages/schemas` | Zod schemas at every boundary; types inferred |
| `packages/crypto` | AES-GCM (WebCrypto) for secrets, X25519+AES-GCM for DMs |
| `packages/db` | Drizzle ORM schema (planned Postgres; live code uses SQLite) |
| `packages/telemetry` | Structured logging / tracing (pino) |
| `packages/game-sdk` | Game SDK utilities |
| `packages/ui` | Shared UI components |
| `packages/ui-public` | UI components for public apps |
| `packages/ui-teams` | UI components for teams apps |
| `packages/config-eslint` | ESLint shared config |
| `packages/config-tailwind` | Tailwind shared config |
| `packages/config-tsconfig` | TypeScript shared configs |

## Commands

```bash
# From repo root:
pnpm install          # Install all deps
pnpm dev              # Dev all apps in parallel (turbo)
pnpm build            # Build all apps
pnpm lint             # Lint all
pnpm typecheck        # Type-check all
pnpm test             # Run tests (vitest in api-gateway, jest in mobile)
pnpm format           # Prettier all files
pnpm clean            # Remove all build artifacts + node_modules

# Per-app (from apps/<name>):
pnpm dev              # Start single app in dev mode
pnpm build            # Build single app
pnpm typecheck        # Type-check single app
```

## Mobile Builds (EAS)

- Account: `waactech`
- Project ID: `b99ce94d-0800-4632-b340-1d42a0691af5`
- Build: `eas build --platform <android|ios> --profile <preview|production>`
- Known patches: `postinstall` strips `-Werror` from react-native-reanimated CMakeLists.txt

## Infrastructure

- **Cloud provider**: Google Cloud Platform (GCP)
- **Container registry**: Artifact Registry
- **Compute**: Cloud Run (api-gateway, web-public, web-teams)
- **Database**: Cloud SQL Postgres (planned; live code uses embedded SQLite)
- **Cache**: Memorystore Redis (secret TTL store)
- **Storage**: Cloud Storage (encrypted blobs, CMEK)
- **KMS**: Cloud KMS (per-workspace KEKs, envelope encryption)
- **Pub/Sub**: moderation, ai_analysis, audit topics
- **Analytics**: BigQuery (append-only audit)
- **IaC**: Terraform in `infra/terraform/`
- **Dockerfiles**: `infra/docker/{api-gateway,web-public,web-teams}.Dockerfile` (node:22-slim, multi-stage)

## Code Conventions

1. **Pure functions** for domain logic — no side effects in `packages/core`
2. **Result types** instead of throws — use `neverthrow`
3. **Schemas first** — Zod at every boundary, types inferred from schemas
4. **Effects at the edge** — Koa middleware & Remix loaders/actions are the only IO
5. **Dependency injection** by parameter (no DI container)
6. **Formatting**: Prettier (run via `pnpm format`)
7. **Linting**: ESLint (shared config in `packages/config-eslint`)

## Design Tokens (Mobile)

- Surface: `#000000`
- Accent: `#FFFC00`
- Text: `#FFFFFF`

## Known Issues / Architecture Debt

- API gateway uses embedded SQLite; Terraform provisions Cloud SQL Postgres (migration pending)
- Crypto docs reference XChaCha20-Poly1305 but implementation uses AES-GCM
- `packages/schemas` and `packages/core` have overlapping validation (dedup needed)
- Web apps have zero test coverage
- Cookie security: inconsistent HttpOnly/Secure flags; passkey login sets JWT via `document.cookie`
- CORS uses wildcard origin with credentials (fix before production)
- JWT passed in SSE query string for DM streaming (move to cookie or header)

## Environment Variables

API gateway expects (see `apps/api-gateway/src/config.ts`):
- `PORT` — server port (default 4000)
- `JWT_SECRET` — signing key
- `DATABASE_URL` — SQLite path or Postgres connection string
- `SES_REGION` / `SES_FROM_EMAIL` — AWS SES for email (legacy)
- `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_ORIGIN` — passkey config

Web public expects:
- `VITE_API_URL` — API gateway URL
- `SESSION_SECRET` — Remix session cookie secret
