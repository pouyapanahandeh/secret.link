# ADR-003: Client Encryption + Server Envelope for At-Rest Keys

## Status
Accepted (updated to match production)

## Context
The public product handles sensitive content (self-destructing secrets, map drops) that must not sit as plaintext in the database.

## Decision
1. **Link / profile secrets:** Client-side AES-256-GCM. The DEK lives in the URL fragment or is wrapped to the recipient's X25519 public key. The server stores ciphertext only.
2. **Map drops:** Client-side AES-256-GCM. The server stores ciphertext + nonce and a DEK wrapped with a server `MASTER_KEY` (AES-GCM). On reveal, the API returns ciphertext + nonce + unwrapped key so the client decrypts. List endpoints never return message content.
3. **Server envelope:** `MASTER_KEY` protects credentials and map DEKs at rest in SQLite. This is not Cloud KMS; it is an application-managed key from the environment / SSM.

## Rationale
- DB dumps without `MASTER_KEY` do not expose map plaintext
- List/map browsing never leaks message bodies
- True multi-viewer map drops require a server-held (wrapped) DEK; pure fragment-only keys cannot support open map discovery
- Link secrets remain zero-knowledge to the server when the key stays in the fragment

## Consequences
- Admin / compliance exports must not include map plaintext (metadata + encrypted flag only)
- Legacy plaintext map rows are expired by migration `map_secrets.encrypt.v1`
- Future KMS (AWS KMS) can replace `MASTER_KEY` wrapping without changing the client ciphertext format
