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
| Capacitor `mobile-teams` | Empty wrapper — deferred with `web-teams` |

## Mobile

| App | Stack | Notes |
|-----|-------|-------|
| `apps/mobile` | Expo / React Native | Native client against the API — the long-term app |
| `apps/mobile-public` | Capacitor | Store wrapper whose WebView loads `https://secretlink.life` |

The Capacitor shell exists because `web-public` is Remix SSR: there is no static
bundle to ship, so it points at the live origin and keeps the `sl_session`
cookie first-party. Bundle ids differ (`link.secret.app` vs the Expo app's
`life.secretlink.app`), so the two can coexist in the stores.

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
| Chat rooms | AES-GCM; key in URL fragment `#k=` | Ciphertext + nonce only. Optional PIN stored as scrypt hash. |

See [ADR-003](./adr/003-zero-knowledge-encryption.md).

Expired chat rooms are **hard-deleted** (messages, members, then the room) every 60s and again on any API hit to an expired id. Live SQLite and any S3 blobs are gone immediately.

Litestream keeps 30 days of point-in-time SQLite history in S3 (`retention: 720h` in `infra/litestream.yml`). Disaster-recovery replicas can still contain ciphertext (not DEKs, not PINs) until that window ends.

## Key principles

1. Pure functions for domain logic (no side effects in `packages/core`)
2. Result types instead of throws (`neverthrow`)
3. Schemas first — Zod at boundaries where adopted
4. Effects at the edge — Koa middleware & Remix loaders/actions are the only IO
5. Dependency injection by parameter
