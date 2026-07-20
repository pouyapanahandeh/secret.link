# Secret.link — Architecture

> Public product on AWS. Teams and several monorepo packages are parked.

## Deployed services

| Service | Port | Purpose |
|---------|------|---------|
| `web-public` | 3000 | Remix SSR — public social app |
| `web-admin` | 3002 | Remix SSR — moderation console |
| `api-gateway` | 4000 | Koa API — main HTTPS API |

Process manager: PM2 on a single EC2 instance behind nginx. See `ecosystem.config.cjs` and `scripts/deploy.sh`.

## Parked (not deployed)

| Service | Notes |
|---------|-------|
| `web-teams` | B2B scaffold — deferred |
| `game-runtime` | Prototype |
| `moderation-worker` / `ai-worker` | Not on the AWS path |
| Capacitor `mobile-*` | Prefer Expo `apps/mobile` |

## Data layer (current)

- **SQLite** — primary store in `apps/api-gateway` (`better-sqlite3`), WAL mode
- **Litestream** — continuous replication of SQLite to S3
- **S3** — encrypted blob storage for media
- **MASTER_KEY** — server AES-256-GCM for wrapping map DEKs / stream credentials (SSM-backed in prod)
- **SES** — transactional email (magic-link path exists but UI-flagged off)

Horizontal scale note: in-process rate limiting and SSE hubs are single-process only. Acceptable while on one EC2; revisit with Redis when scaling out.

**Parked:** `packages/db` (Drizzle/Postgres schema) is a future migration target — not wired in production. API data access uses SQLite repositories under `apps/api-gateway/src/repositories/` until ~100k users / HA requirements.

## Encryption model

| Content | Client | Server storage |
|---------|--------|----------------|
| Link / profile secrets | AES-GCM; key in URL fragment or X25519 wrap | Ciphertext only |
| Map drops | AES-GCM on client | Ciphertext + nonce + `MASTER_KEY`-wrapped DEK; reveal returns key material for client decrypt |
| DMs (flagged off) | X25519 + AES-GCM | Ciphertext + nonce |

See [ADR-003](./adr/003-zero-knowledge-encryption.md).

## Key principles

1. Pure functions for domain logic (no side effects in `packages/core`)
2. Result types instead of throws (`neverthrow`)
3. Schemas first — Zod at boundaries where adopted
4. Effects at the edge — Koa middleware & Remix loaders/actions are the only IO
5. Dependency injection by parameter
