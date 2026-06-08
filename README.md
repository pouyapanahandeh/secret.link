# secret.link

> One brand. Two products. One monorepo. One GCP project.

- **Secret.link for Teams** — anonymous feedback, pulse surveys & team-building games for companies
- **Secret.link (public)** — a "secret social" network where every message self-destructs

## Quick Start

```bash
# Install dependencies
pnpm install

# Run everything in dev mode
pnpm dev

# Run specific apps
pnpm --filter @secretlink/api-gateway dev    # API on :4000
pnpm --filter @secretlink/web-public dev     # Public app on :3000
pnpm --filter @secretlink/web-teams dev      # Teams app on :3001

# Run tests
pnpm test

# Typecheck
pnpm typecheck
```

## Monorepo Structure

```
├─ apps/
│  ├─ web-teams/           # Remix (TS) — B2B app, SSR
│  ├─ web-public/          # Remix (TS) — public app, SSR
│  ├─ mobile-teams/        # Capacitor wrapper + native modules
│  ├─ mobile-public/       # Capacitor wrapper + native modules
│  ├─ api-gateway/         # Koa (TS) — main HTTPS API
│  ├─ moderation-worker/   # Pub/Sub consumer — content moderation
│  ├─ ai-worker/           # Vertex AI orchestration
│  └─ game-runtime/        # Sandboxed game module executor
│
├─ packages/
│  ├─ ui/                  # Shared design-system (Radix + Tailwind)
│  ├─ ui-teams/            # Teams brand tokens
│  ├─ ui-public/           # Public brand tokens
│  ├─ core/                # Pure-functional domain logic
│  ├─ crypto/              # Client-side encryption (libsodium)
│  ├─ schemas/             # Zod schemas (single source of truth)
│  ├─ db/                  # Drizzle ORM schema + migrations
│  ├─ telemetry/           # OpenTelemetry wiring
│  ├─ game-sdk/            # SDK for community game authors
│  ├─ config-eslint/       # Shared ESLint config
│  ├─ config-tsconfig/     # Shared TypeScript configs
│  └─ config-tailwind/     # Shared Tailwind configs
│
├─ infra/
│  ├─ terraform/           # All GCP infra as code
│  ├─ cloudbuild/          # CI/CD pipelines
│  └─ docker/              # Distroless Dockerfiles
│
├─ docs/                   # Architecture, ADRs, runbooks
└─ .changeset/             # Versioning
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Remix v2 + Vite + Tailwind |
| API | Koa 2 (TypeScript, functional) |
| Database | Cloud SQL Postgres (Drizzle ORM) |
| Cache | Memorystore Redis |
| Storage | Cloud Storage (CMEK) |
| Encryption | libsodium (XChaCha20-Poly1305) + Cloud KMS |
| AI | Vertex AI (Gemini Flash) |
| Infra | GCP Cloud Run, Terraform |
| CI/CD | Cloud Build + Turborepo remote cache |
| Mobile | Capacitor 6 |

## Architecture Principles

1. **Pure functions** for domain logic — no side effects in `packages/core`
2. **Result types** instead of throws (`neverthrow`)
3. **Schemas first** — Zod at every boundary, types inferred
4. **Effects at the edge** — only Koa middleware & Remix loaders touch IO
5. **Dependency injection by parameter**
6. **Immutability by default**

## License

Proprietary. All rights reserved.
