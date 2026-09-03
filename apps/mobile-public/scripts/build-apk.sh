#!/usr/bin/env bash
# Builds an Android APK for the Capacitor shell and copies it into artifacts/.
# Usage: ./scripts/build-apk.sh [debug|release]
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

VARIANT="${1:-debug}"

# Capacitor 6 ships Gradle 8.2 / AGP 8.2, which reject JDKs newer than 21.
java_ok() {
  [ -n "${1:-}" ] && [ -x "$1/bin/java" ] &&
    "$1/bin/java" -version 2>&1 | head -1 | grep -qE '"(17|21)[.\"]'
}

if ! java_ok "${JAVA_HOME:-}"; then
  for candidate in \
    "$(/usr/libexec/java_home -v 21 2>/dev/null || true)" \
    "$(/usr/libexec/java_home -v 17 2>/dev/null || true)" \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
    if java_ok "$candidate"; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if ! java_ok "${JAVA_HOME:-}"; then
  echo "error: need JDK 17 or 21 (install Android Studio or 'brew install openjdk@21')" >&2
  exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [ ! -d "$ANDROID_HOME/platforms" ]; then
  echo "error: Android SDK not found at $ANDROID_HOME (set ANDROID_HOME)" >&2
  exit 1
fi

if [ ! -d android ]; then
  echo "error: android/ missing - run 'pnpm add:android' first" >&2
  exit 1
fi

case "$VARIANT" in
  debug) GRADLE_TASK="assembleDebug" ;;
  release) GRADLE_TASK="assembleRelease" ;;
  *) echo "error: variant must be 'debug' or 'release'" >&2; exit 1 ;;
esac

echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"

# local.properties is gitignored, so regenerate it for this machine.
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties

(cd android && ./gradlew --no-daemon "$GRADLE_TASK")

VERSION="$(node -p "require('./package.json').version")"
mkdir -p artifacts
SRC="android/app/build/outputs/apk/$VARIANT/app-$VARIANT.apk"
if [ ! -f "$SRC" ]; then
  SRC="$(find android/app/build/outputs/apk/"$VARIANT" -name '*.apk' | head -1)"
fi
DEST="artifacts/secretlink-$VERSION-$VARIANT.apk"
cp "$SRC" "$DEST"

echo
echo "APK: $APP_DIR/$DEST"
echo "Install with: adb install -r $DEST"
