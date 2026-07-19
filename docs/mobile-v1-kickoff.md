# Mobile v1 Kickoff Scope (1 August 2026)

Expo app: `apps/mobile`. Capacitor shells remain parked.

## API contract freeze (public product)

These routes are considered stable for mobile v1. Prefer additive changes only.

### Auth
- `POST /v1/users` — signup (handle, optional email); session via `sl_token` cookie / Bearer JWT
- `POST /v1/users/auth/passkey/*` — web passkeys; **mobile v1 may defer passkeys**
- `POST /v1/users/auth/logout`
- `GET /v1/users/me`, `GET|PATCH /v1/users/me/profile`
- Feature flags (`@secretlink/core/feature-flags`): keep `messages`, `live`, `magicLink` **false**

### Profiles & social
- `GET /v1/users/:handle`
- `GET /v1/users/search?q=`
- `POST|DELETE|GET /v1/users/follow/:targetId`
- `GET /v1/users/me/followers`, `/me/following`
- `GET /v1/users/me/stats`, QR/social track endpoints as used by web share

### Secrets (link / profile-addressed)
- `POST /v1/secrets` — ciphertext + nonce (+ optional wrap fields for recipient)
- `GET /v1/secrets/:id` — reveal (burns / view limits)
- `GET /v1/secrets/inbox/:handle`, `/sent/:userId` (auth)
- `POST /v1/secrets/blob`, `GET /v1/secrets/blob/:path`

Client encrypts with AES-256-GCM (see `apps/mobile/lib/secret-crypto.ts` and web `app/lib/crypto.ts`).

### Map drops (encrypted)
- `GET /v1/secrets/map` — metadata only (no message)
- `POST /v1/secrets/map` — body: `{ ciphertext, nonce, key, lat, lng, emoji, ttlMinutes, ... }`
- `POST /v1/secrets/map/:id/reveal` — returns `{ ciphertext, nonce, key }` for client decrypt (not plaintext)
- `GET /v1/secrets/map/by-handle/:handle`
- `POST /v1/secrets/map/:id/report`

Use `encryptMapMessage` / `decryptMapReveal` in `apps/mobile/lib/secret-crypto.ts`.

### Health
- `GET /v1/health` — `{ status, checks: { db } }`

## Mobile v1 product scope

**In:**
1. Auth: signup / login parity with JWT session storage on device
2. Home: inbox list + open/reveal profile secrets
3. Send secret to a handle (encrypted)
4. Public profile view + follow
5. Map: list pins, drop encrypted secret, reveal + decrypt
6. Own profile edit (bio, socials, avatar URL upload via blob)
7. Share profile link (native share sheet)

**Out (for later):**
- Passkeys / WebAuthn on device
- DMs, live streaming, magic-link (`UI_FEATURES` stay off)
- Teams / billing
- Capacitor wrappers

## Shared packages to prefer

- `@secretlink/core` — feature flags, profile URL/share helpers, secret create/reveal domain
- `@secretlink/schemas` — when Zod schemas cover the route
- Keep client crypto in `apps/mobile/lib/secret-crypto.ts` aligned with web AES-GCM + base64url

## Kickoff checklist

- [ ] Confirm Expo SDK / store target versions
- [ ] Point mobile `API_BASE` at staging/prod with CORS allowlist update if needed
- [ ] Smoke: signup → edit profile → share; create link secret → reveal; map drop → reveal
- [ ] Do not enable flagged features in mobile UI
- [ ] Avoid breaking changes to map encrypt payload (`ciphertext` / `nonce` / `key`)
