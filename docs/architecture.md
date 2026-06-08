# Secret.link — Architecture

> One brand. Two products. One monorepo. One GCP project.

## Services

| Service | Port | Purpose |
|---------|------|---------|
| `web-public` | 3000 | Remix SSR — public social app |
| `web-teams` | 3001 | Remix SSR — B2B teams app |
| `api-gateway` | 4000 | Koa API — main HTTPS API |
| `game-runtime` | 4002 | Sandboxed game module executor |
| `moderation-worker` | — | Pub/Sub consumer — content moderation |
| `ai-worker` | — | Pub/Sub consumer — Vertex AI analysis |

## Data Layer

- **Cloud SQL Postgres** — metadata (users, workspaces, handles, tags)
- **Memorystore Redis** — short-TTL secret store (max 30 days)
- **Cloud Storage** — large encrypted blobs (CMEK)
- **Cloud KMS** — per-workspace KEKs, DEK envelope encryption
- **BigQuery** — append-only audit + analytics

## Key Principles

1. Pure functions for domain logic (no side effects in `packages/core`)
2. Result types instead of throws (`neverthrow`)
3. Schemas first — Zod at every boundary, types inferred
4. Effects at the edge — Koa middleware & Remix loaders/actions are the only IO
5. Dependency injection by parameter
