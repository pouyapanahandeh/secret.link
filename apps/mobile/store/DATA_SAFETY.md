# Google Play Data safety answers (Secretlink)

Align the Play Console Data safety form with https://secretlink.life/privacy.

## Data collected

| Data type | Collected | Shared | Purpose | Optional |
| --- | --- | --- | --- | --- |
| Email address | Yes (if provided) | No | Account management | Yes |
| User IDs / handle | Yes | No* | App functionality, account | No |
| Approximate location | Yes | No* | Map secrets nearby | Yes (permission) |
| Precise location | Yes | No* | Map drops / nearby stories | Yes (permission) |
| Photos / videos | Yes (user-selected) | No* | Attachments for secrets | Yes |
| Messages / secrets ciphertext | Yes | No* | App functionality | No |
| Device / push tokens | Yes | No | Notifications | Yes |
| Crash logs | Possibly (hosting) | No | Stability | No |

\*Content is end-to-end encrypted where applicable; server stores ciphertext/metadata needed to deliver ephemeral secrets. Public profile fields (handle, bio, avatar) are visible to others by design.

## Security practices

- Data encrypted in transit (HTTPS/TLS)
- Users can request deletion (in-app delete account)
- Encryption at rest for stored blobs as provided by infrastructure
- Committed to following Play Families / child policies: **app is 18+ only**

## Not collected

- Financial info, health, contacts list, SMS, calendar, installed apps, web browsing history (beyond in-app usage), advertising ID for ads (no ads)
