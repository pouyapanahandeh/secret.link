# Secretlink Threat Model (Public Product)

This document describes what Secretlink protects, what the server can see, and known trust boundaries for the public product (`web-public` + `api-gateway`).

## Assets

| Asset | Owner | Protection goal |
|-------|-------|-----------------|
| Secret plaintext (links, profile inbox, map drops) | User | Server must not learn content |
| AES content keys (URL fragment or X25519 wrap) | User | Only intended recipient learns key |
| Map DEKs at rest | Server | Wrapped with `MASTER_KEY`; plaintext DEK never stored |
| Account handle / profile metadata | User | Integrity; minimal PII exposure |
| Session JWT | User | Confidentiality; HttpOnly delivery |

## Client-side encryption scope

- **Link secrets & profile-addressed secrets:** AES-256-GCM on the client. Keys travel in the URL fragment or via X25519 wrap (`wrappedKey`, `wrapNonce`, `wrapEpk`).
- **Map drops:** AES-256-GCM on the client. Server stores ciphertext + nonce + `MASTER_KEY`-wrapped DEK. Reveal returns ciphertext bundle + unwrapped DEK as base64url for client decrypt.
- **Canonical implementation:** `@secretlink/crypto` (shared by web and mobile).

## What the server cannot see

- Plaintext secret bodies (when clients use encryption correctly)
- URL fragment keys for anonymous link secrets
- Unwrapped AES keys for profile secrets (only opaque wrap blobs stored)
- Map message plaintext (only ciphertext + wrapped DEK)

## What the server can see

- Ciphertext, nonces, TTLs, view counts, burn state
- Handles, public profile fields, follower graph
- Coarse map metadata (lat/lng, emoji, place names, expiry)
- IP-derived rate limits and abuse signals (not stored as content)
- Moderation reports and admin audit actions

## Server key wrapping (`MASTER_KEY`)

Map DEKs and similar server-side key material are wrapped with AES-256-GCM using a 32-byte `MASTER_KEY` from SSM in production. Compromise of `MASTER_KEY` allows decrypting stored map DEKs (not client-wrapped profile secret keys).

## Authentication model

- API issues JWT in HttpOnly cookie `sl_token` (or Bearer for mobile).
- Web Remix stores the JWT inside encrypted session cookie `sl_session` (distinct name to avoid collision).
- Passkeys (WebAuthn) bind credentials to handles.

## Moderation & compliance boundaries

- Users can report map drops; admins act on metadata and decrypted content only when legally required or for enforcement.
- GDPR export/deletion removes account metadata; ephemeral ciphertext may already be burned/expired.
- Transparency stats are aggregate counts — no secret content.

## Out of scope (parked features)

Teams/B2B, billing, DMs/live UI (`messages`, `live`, `magicLink` flags remain off) are not part of this threat model until enabled.

## Residual risks

| Risk | Mitigation |
|------|------------|
| Client fails to encrypt | API validates ciphertext presence; map requires encrypted fields |
| XSS on web | CSP, HttpOnly cookies, no inline secret keys in DOM |
| `MASTER_KEY` leak | SSM + rotation runbook; minimal DEK exposure window |
| SQLite single-host | Litestream backup; Postgres/HA deferred until scale |

See also [architecture.md](./architecture.md) and [ADR-003](./adr/003-zero-knowledge-encryption.md).
