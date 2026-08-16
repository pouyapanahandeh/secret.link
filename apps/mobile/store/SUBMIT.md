# Submit Secretlink Android to Google Play

## Production artifact (ready)

- EAS build: https://expo.dev/accounts/waactech/projects/secretlink/builds/00000000-0000-0000-0000-000000000000
- AAB download: https://expo.dev/artifacts/eas/REDACTED_ARTIFACT.aab
- Local copy: `store/releases/secretlink-1.0.0-vc4.aab`
- Package: `life.secretlink.app`
- Version: `1.0.0` (versionCode `4`)
- Upload key SHA-256: `43:73:2F:16:04:79:95:85:8D:04:D7:8D:72:55:85:B9:1C:B1:27:CC:57:C0:44:5F:38:79:CB:48:3B:ED:FE:0E`

## Accounts (must be ops@example.com)

- Expo / EAS: `waactech` ← `ops@example.com`
- Google Cloud active account: `ops@example.com`
- Play upload service account (for later EAS submit): `play-publisher@your-gcp-project.iam.gserviceaccount.com`
  - Lives in GCP project `your-gcp-project` owned/accessible by `ops@example.com`

**First Play upload cannot be automated.** Google requires creating the app + uploading the first AAB in Play Console UI: https://expo.fyi/first-android-submission

## Option A — Play Console UI (required for first publish)

Sign into Play Console as **ops@example.com** (not another Google account).

1. https://play.google.com/console → Create app → **Secretlink**
2. Complete declarations (18+, UGC, location, privacy policy URL `https://secretlink.life/privacy`)
3. Store listing: paste text from `store/en-US/`, upload `store/icon-512.png`, `store/feature-graphic.png`, `store/screenshots/*` (or Desktop zip `secretlink-play-listing-assets.zip`)
4. Data safety: follow `store/DATA_SAFETY.md`
5. Testing → Internal testing → Create release → upload Desktop file `secretlink-1.0.0-vc4.aab` (package `life.secretlink.app`, versionCode 4)
6. Link GCP project `your-gcp-project` under Play Console → Setup → API access, then grant **Admin** (or Release apps) to `play-publisher@your-gcp-project.iam.gserviceaccount.com`
7. After Play App Signing is enabled, copy the **App signing key** SHA-256 into `apps/web-public/public/.well-known/assetlinks.json` and deploy the site
8. Later updates: `eas submit -p android --latest --profile production`

## Option B — EAS Submit (automation)

1. Play Console → Users and permissions → Invite new service account  
   (or Google Cloud → create service account with Play Android Developer role, link in Play Console)
2. Download JSON key (do **not** commit it)
3. From `apps/mobile`:

```bash
eas submit -p android --id 00000000-0000-0000-0000-000000000000 --profile production
```

When prompted, provide the service-account JSON path.  
`eas.json` is set to upload as **internal track / draft** so you can review before production rollout.

## Google Maps API key (required for Android map tiles)

Create a Maps SDK for Android key in Google Cloud, restrict it to `life.secretlink.app` + upload SHA-1 `51:42:A9:7B:1E:6D:C3:F4:88:F8:C1:A1:68:45:45:83:B0:1A:0F:29`, then:

```bash
eas env:create --name GOOGLE_MAPS_API_KEY --value 'YOUR_KEY' --environment production --visibility sensitive
```

Rebuild production after setting the key.
