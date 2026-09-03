#!/usr/bin/env bash
# Builds an iOS .ipa for the Capacitor shell and copies it into artifacts/.
#
# Without a signing identity this produces an UNSIGNED .ipa, which is suitable
# for inspection or for re-signing, but cannot be installed on a device as-is.
# Set DEVELOPMENT_TEAM=<10-char Apple team id> to produce a signed build.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# xcode-select often points at the CommandLineTools instance, which cannot build apps.
if [ -z "${DEVELOPER_DIR:-}" ] && [ -d /Applications/Xcode.app ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "error: Xcode required (DEVELOPER_DIR=${DEVELOPER_DIR:-unset})" >&2
  exit 1
fi

if [ ! -d ios/App ]; then
  echo "error: ios/ missing - run 'pnpm add:ios' first" >&2
  exit 1
fi

ARCHIVE="$APP_DIR/ios/App/build/App.xcarchive"
rm -rf "$ARCHIVE"

SIGN_ARGS=(CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" CODE_SIGN_ENTITLEMENTS="")
if [ -n "${DEVELOPMENT_TEAM:-}" ]; then
  SIGN_ARGS=(DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" -allowProvisioningUpdates)
fi

# No -destination: Xcode only reports a generic iOS destination once the full
# device platform is downloaded, but archiving against the SDK works without it.
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -archivePath "$ARCHIVE" \
  ONLY_ACTIVE_ARCH=NO \
  "${SIGN_ARGS[@]}" \
  archive

VERSION="$(node -p "require('./package.json').version")"
mkdir -p artifacts
DEST="artifacts/secretlink-$VERSION.ipa"

# An .ipa is just a zip with the .app inside a Payload/ directory.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/Payload"
cp -R "$ARCHIVE/Products/Applications/App.app" "$STAGE/Payload/"
(cd "$STAGE" && zip -qry payload.zip Payload)
cp "$STAGE/payload.zip" "$DEST"

echo
echo "IPA: $APP_DIR/$DEST"
if [ -z "${DEVELOPMENT_TEAM:-}" ]; then
  echo "NOTE: unsigned - open ios/App/App.xcodeproj in Xcode and set a team to run on a device."
fi
