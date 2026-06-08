# ADR-003: Zero-Knowledge Encryption Model

## Status
Accepted

## Context
Both products handle sensitive content (anonymous feedback, private messages) that must remain unreadable to the server.

## Decision
Client-side AES-GCM (via libsodium/XChaCha20-Poly1305) with a server-side KMS envelope.

## Rationale
- Client encrypts plaintext before sending → server never sees it
- Cloud KMS wraps per-secret DEKs → even a DB leak doesn't expose content
- Two-layer model: client AES-GCM + KMS envelope
- k-anonymity guards in Teams product add statistical protection

## Consequences
- Server-side AI features (tone analysis, auto-grouping) only work after authorised reveal
- Moderation pipeline operates on ciphertext metadata + pre-submission client-side scan
- Search is not possible on encrypted content (by design)
