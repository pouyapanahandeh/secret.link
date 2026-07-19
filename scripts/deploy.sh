#!/usr/bin/env bash
set -euo pipefail

# ─── Secretlink versioned deploy with rollback ───────────────────────────────
# Each deploy goes into releases/<timestamp>; `current` is a symlink swapped
# atomically only after the build + health check succeed. Roll back with:
#   ./scripts/deploy.sh --rollback
#
# Secrets are pulled from SSM on the server (scripts/pull-ssm-env.sh) if
# available; otherwise the existing server-side .env is reused.

SERVER="${DEPLOY_SERVER:-ubuntu@203.0.113.10}"
SSH_KEY="${DEPLOY_KEY:-$HOME/.ssh/secretlink-key.pem}"
BASE_DIR="/home/ubuntu/secretlink-releases"
LEGACY_DIR="/home/ubuntu/secretlink"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE="$(date +%Y%m%dT%H%M%S)"

SSH_CMD=(ssh -i "$SSH_KEY" "$SERVER")

# ─── Rollback mode ────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--rollback" ]]; then
  echo "──── Rolling back to previous release ────"
  "${SSH_CMD[@]}" "
    set -e
    cd $BASE_DIR
    prev=\$(ls -1d 2* | sort | tail -2 | head -1)
    [ -n \"\$prev\" ] || { echo 'No previous release found'; exit 1; }
    ln -sfn $BASE_DIR/\$prev $BASE_DIR/current
    cd $BASE_DIR/current && pm2 restart all --update-env
    echo \"Rolled back to \$prev\"
  "
  exit 0
fi

echo "──── Secretlink Deploy ($RELEASE) ────"
echo "Local:  $LOCAL_DIR"
echo "Remote: $SERVER:$BASE_DIR/$RELEASE"
echo ""

# ─── 1. Pre-deploy DB backup ─────────────────────────────────────────────────
echo "→ Backing up database..."
"${SSH_CMD[@]}" "
  set -e
  DATA_DIR=\$(readlink -f $BASE_DIR/shared/data 2>/dev/null || echo $LEGACY_DIR/apps/api-gateway/data)
  if [ -f \"\$DATA_DIR/secretlink.db\" ]; then
    cp \"\$DATA_DIR/secretlink.db\" \"\$DATA_DIR/secretlink.pre-deploy-$RELEASE.db\"
    ls -1t \"\$DATA_DIR\"/secretlink.pre-deploy-*.db | tail -n +6 | xargs -r rm --
    echo \"  Backup: secretlink.pre-deploy-$RELEASE.db\"
  else
    echo '  No existing DB found (first deploy?)'
  fi
"

# ─── 2. Prepare shared dirs (data, blobs, .env survive releases) ─────────────
"${SSH_CMD[@]}" "
  mkdir -p $BASE_DIR/releases $BASE_DIR/shared/data $BASE_DIR/shared/blobs
  if [ ! -f $BASE_DIR/shared/.env ] && [ -f $LEGACY_DIR/.env ]; then cp $LEGACY_DIR/.env $BASE_DIR/shared/.env; fi
  # Seed shared data from the legacy layout on first versioned deploy.
  if [ ! -f $BASE_DIR/shared/data/secretlink.db ] && [ -f $LEGACY_DIR/apps/api-gateway/data/secretlink.db ]; then
    cp $LEGACY_DIR/apps/api-gateway/data/secretlink.db* $BASE_DIR/shared/data/ 2>/dev/null || true
  fi
"

# ─── 3. Rsync source into the new release dir ────────────────────────────────
echo "→ Syncing source..."
rsync -az --delete \
  --exclude 'node_modules' --exclude '.git' \
  --exclude 'apps/mobile' --exclude 'apps/mobile-public' --exclude 'apps/mobile-teams' \
  --exclude 'apps/web-teams' --exclude 'apps/game-runtime' \
  --exclude 'apps/ai-worker' --exclude 'apps/moderation-worker' \
  --exclude '.turbo' --exclude 'apps/web-public/build' --exclude 'apps/web-admin/build' \
  --exclude 'apps/api-gateway/data' --exclude 'apps/api-gateway/.blobs' \
  --exclude '*.db' --exclude '*.db-shm' --exclude '*.db-wal' --exclude '.env' \
  -e "ssh -i $SSH_KEY" \
  "$LOCAL_DIR/" "$SERVER:$BASE_DIR/releases/$RELEASE/" | tail -3

# ─── 4. Wire shared state into the release ───────────────────────────────────
"${SSH_CMD[@]}" "
  set -e
  cd $BASE_DIR/releases/$RELEASE
  ln -sfn $BASE_DIR/shared/data apps/api-gateway/data
  ln -sfn $BASE_DIR/shared/blobs apps/api-gateway/.blobs
  # Refresh .env from SSM when possible; fall back to the existing shared .env.
  if aws sts get-caller-identity >/dev/null 2>&1; then
    bash scripts/pull-ssm-env.sh > $BASE_DIR/shared/.env.new && mv $BASE_DIR/shared/.env.new $BASE_DIR/shared/.env || true
  fi
  ln -sfn $BASE_DIR/shared/.env .env
"

# ─── 5. Install & build ──────────────────────────────────────────────────────
echo "→ Installing dependencies + building..."
"${SSH_CMD[@]}" "
  set -e
  cd $BASE_DIR/releases/$RELEASE
  pnpm install --frozen-lockfile 2>&1 | tail -2 || pnpm install --no-frozen-lockfile 2>&1 | tail -2
  (cd apps/web-public && pnpm build 2>&1 | tail -2)
  (cd apps/web-admin && pnpm build 2>&1 | tail -2)
"

# ─── 6. Swap symlink + restart ───────────────────────────────────────────────
echo "→ Activating release..."
"${SSH_CMD[@]}" "
  set -e
  ln -sfn $BASE_DIR/releases/$RELEASE $BASE_DIR/current
  cd $BASE_DIR/current
  # PM2 is anchored to the \`current\` symlink (see ecosystem.config.cjs APP_ROOT),
  # so a zero-downtime reload re-execs against this release.
  pm2 startOrReload ecosystem.config.cjs --update-env 2>&1 | tail -3
  # Self-heal: if any process is still pinned to a non-current absolute path
  # (this is the bug that made deploys silent no-ops), re-register cleanly.
  if pm2 jlist | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const bad=JSON.parse(s).some(p=>!(p.pm2_env.pm_cwd||\"\").includes(\"/current/\"));process.exit(bad?1:0)})'; then
    echo '  PM2 anchored to current release ✓'
  else
    echo '  ⚠ PM2 was not anchored to current — re-registering cleanly'
    pm2 delete all || true
    pm2 start ecosystem.config.cjs --update-env 2>&1 | tail -3
    pm2 save
  fi
"
sleep 3

# ─── 7. Health check (auto-rollback on failure) ──────────────────────────────
echo "→ Health check..."
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://secretlink.life/ || echo 000)
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://secretlink.life/v1/health || echo 000)
# Require health JSON to report db ok (in addition to HTTP 200).
API_DB_OK=$(curl -s https://secretlink.life/v1/health | node -e "
let s = '';
process.stdin.on('data', (d) => { s += d; });
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(s);
    process.stdout.write(j.status === 'ok' && j.checks && j.checks.db === 'ok' ? 'yes' : 'no');
  } catch {
    process.stdout.write('no');
  }
});
")
MAP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://secretlink.life/v1/secrets/map || echo 000)
echo "  Web: $WEB_STATUS   API: $API_STATUS   DB: $API_DB_OK   Map list: $MAP_STATUS"

if [[ "$WEB_STATUS" == "200" && "$API_STATUS" == "200" && "$API_DB_OK" == "yes" && "$MAP_STATUS" == "200" ]]; then
  echo "→ Pruning old releases (keep 5)..."
  "${SSH_CMD[@]}" "cd $BASE_DIR/releases && ls -1 | sort | head -n -5 | xargs -r rm -rf --"
  echo "✅ Deploy $RELEASE successful."
else
  echo "⚠️  Health check failed — rolling back."
  "$0" --rollback
  exit 1
fi
