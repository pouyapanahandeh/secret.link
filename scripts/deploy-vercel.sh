#!/usr/bin/env bash
set -euo pipefail

# Deploy script for Vercel using Build Output API v3
# Usage: ./scripts/deploy-vercel.sh <app> [--prod]
# Example: ./scripts/deploy-vercel.sh web-public --prod

APP="${1:-}"
PROD_FLAG="${2:-}"

if [[ -z "$APP" ]]; then
  echo "Usage: $0 <web-public|web-teams> [--prod]"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/$APP"

if [[ ! -d "$APP_DIR" ]]; then
  echo "Error: App directory $APP_DIR does not exist"
  exit 1
fi

echo "==> Building @secretlink/$APP..."
cd "$ROOT_DIR"
pnpm turbo run build --filter="@secretlink/$APP..." --force

echo "==> Assembling Vercel output..."
rm -rf "$APP_DIR/.vercel/output"
mkdir -p "$APP_DIR/.vercel/output/static"
mkdir -p "$APP_DIR/.vercel/output/functions/index.func"

# Copy static assets
cp -r "$APP_DIR/build/client/"* "$APP_DIR/.vercel/output/static/"

# Copy server bundle (self-contained, no node_modules needed)
cp "$APP_DIR/build/server/index.js" "$APP_DIR/.vercel/output/functions/index.func/index.mjs"
if [[ -d "$APP_DIR/build/server/assets" ]]; then
  cp -r "$APP_DIR/build/server/assets" "$APP_DIR/.vercel/output/functions/index.func/assets"
fi

# Create function config
cat > "$APP_DIR/.vercel/output/functions/index.func/.vc-config.json" << 'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.mjs",
  "launcherType": "Nodejs",
  "supportsResponseStreaming": true
}
EOF

# Create package.json for ESM
cat > "$APP_DIR/.vercel/output/functions/index.func/package.json" << 'EOF'
{"type": "module"}
EOF

# Create output config with routing
cat > "$APP_DIR/.vercel/output/config.json" << 'EOF'
{
  "version": 3,
  "routes": [
    {
      "src": "/assets/(.*)",
      "headers": { "Cache-Control": "public, max-age=31536000, immutable" },
      "continue": true
    },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index" }
  ]
}
EOF

echo "==> Deploying to Vercel..."
cd "$APP_DIR"
if [[ "$PROD_FLAG" == "--prod" ]]; then
  vercel deploy --prebuilt --prod --yes
else
  vercel deploy --prebuilt --yes
fi

echo "==> Done!"
