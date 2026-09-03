# Mobile app — Public (Capacitor)

Native Android/iOS shell that loads the production public site in a WebView.

`web-public` is a Remix **SSR** app, so its `build/client` output is not a
standalone bundle and cannot be shipped inside the app. Instead the shell points
at the live origin:

```json
"server": { "url": "https://secretlink.life" }
```

That keeps server loaders/actions and the first-party `sl_session` cookie
working exactly as they do in a browser, with no API CORS changes. The bundled
[www/index.html](www/index.html) is only a fallback screen shown when the site
is unreachable.

This is a store wrapper for the website. The native product is the Expo app in
[`apps/mobile`](../mobile) — the two are separate apps with separate ids:

| App | Id |
|-----|-----|
| Capacitor shell (this app) | `link.secret.app` |
| Expo native app | `life.secretlink.app` |

## Prerequisites

- **Android:** Android Studio + SDK 36, and a JDK 17 or 21 (Gradle rejects
  newer JDKs — the build script auto-detects Android Studio's bundled JDK 21)
- **iOS:** Xcode, with its license accepted once per machine:

```bash
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
```

Dependencies resolve through Swift Package Manager (`ios/App/CapApp-SPM`), so
CocoaPods is only needed if you add a plugin that ships no `Package.swift`.

## Build

```bash
pnpm install

# Android -> artifacts/secretlink-<version>-debug.apk
pnpm --filter @secretlink/mobile-public sync
pnpm --filter @secretlink/mobile-public build:apk

# iOS -> artifacts/secretlink-<version>.ipa
pnpm --filter @secretlink/mobile-public build:ipa
```

`build:apk release` produces an unsigned release APK. For Play Store uploads
generate an `.aab` instead:

```bash
cd android && ./gradlew bundleRelease
```

`build:ipa` produces an **unsigned** `.ipa` by default, which cannot be
installed on a device. Pass an Apple team id to sign it:

```bash
DEVELOPMENT_TEAM=XXXXXXXXXX pnpm --filter @secretlink/mobile-public build:ipa
```

## Run on a device

```bash
adb install -r artifacts/secretlink-0.0.1-debug.apk   # Android
pnpm --filter @secretlink/mobile-public open:ios      # then Run in Xcode
```

## Icons and splash

Generated from [assets/logo.png](assets/logo.png) by `@capacitor/assets`:

```bash
pnpm --filter @secretlink/mobile-public assets
```

## The UI comes from production

Because the WebView loads the deployed site, changes to `web-public` only reach
the apps after a web deploy — no rebuild of the APK/IPA is needed. **Until that
deploy lands the apps still show the plain website**, including the marketing
landing page.

## App mode

The shell appends `SecretlinkApp/1` to the user agent. `web-public` reads it on
the **server** ([native.server.ts](../web-public/app/lib/native.server.ts)) and
exposes it through the root loader, so app chrome renders in the first response
instead of flashing the marketing layout and swapping after hydration.

In app mode:

- `/` redirects to `/login`, which gains a **Continue without an account**
  action into `/send` (secrets, files, camera, and chat all work anonymously)
- [SiteChrome](../web-public/app/components/SiteChrome.tsx) renders
  [AppShell](../web-public/app/components/AppShell.tsx) instead of the site nav
  and footer: a fixed app bar plus a Send / Chat / Log in bottom tab bar
- `[data-native="true"]` CSS in [tailwind.css](../web-public/app/tailwind.css)
  drops overscroll bounce, tap highlights, and scrollbars
- the PWA install banner is suppressed

Screens keep their web routes, so any link into the site still resolves. To work
on app mode locally, point `server.url` at `http://10.0.2.2:3005` with
`"cleartext": true`, run `npx remix vite:dev --host 0.0.0.0 --port 3005`, then
`npx cap sync android`. The debug manifest already allows cleartext; release
builds stay HTTPS-only.

## Passkey login

Android's embedded WebView exposes no WebAuthn API, so passkey login silently
fails without native help. [MainActivity](android/app/src/main/java/link/secret/app/MainActivity.java)
opts into the platform Credential Manager via `setWebAuthenticationSupport`; it
logs `WebAuthn enabled for this WebView` under the `SecretlinkPasskeys` tag on
launch.

The WebView only releases credentials for `secretlink.life` once that domain's
[assetlinks.json](../web-public/public/.well-known/assetlinks.json) grants
`delegate_permission/common.get_login_creds` to this package **and** its signing
certificate. The entry there is the shared **debug** fingerprint, so:

- passkey login works in debug builds after the next web deploy
- a release build needs its own keystore's SHA-256 added to that file, or login
  will fail with no matching credential

iOS is not wired up: WKWebView passkeys need the Associated Domains entitlement
plus a hosted `apple-app-site-association`, which needs an Apple Developer team.
Until then iOS users take the no-account path.

## Native APIs

Camera, microphone, and geolocation work through the standard web APIs the site
already uses (`getUserMedia`, `navigator.geolocation`); the native projects just
declare the matching OS permissions. Anything the browser cannot do — biometric
unlock, secure enclave storage, screen-capture blocking, push tokens — needs a
Capacitor plugin plus JS in `web-public` guarded by
[`isNativeShell()`](../web-public/app/lib/native.ts). The push plugins are
installed but not wired up; Android push also needs a `google-services.json`.
