#!/usr/bin/env bash
set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
SERVER="ubuntu@203.0.113.10"
SSH_KEY="$HOME/.ssh/secretlink-key.pem"
REMOTE_DIR="/home/ubuntu/secretlink"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

SSH_CMD="ssh -i $SSH_KEY $SERVER"

echo "──── Secretlink Deploy ────"
echo "Local:  $LOCAL_DIR"
echo "Remote: $SERVER:$REMOTE_DIR"
echo ""

# ─── 1. Pre-deploy backup on server ─────────────────────────────────────────
echo "→ Creating database backup on server..."
BACKUP_NAME="secretlink.pre-deploy-$(date +%Y%m%dT%H%M%S).db"
$SSH_CMD "cd $REMOTE_DIR/apps/api-gateway && \
  cp data/secretlink.db data/$BACKUP_NAME && \
  echo '  Backup: data/$BACKUP_NAME' && \
  echo '  Size: '\$(du -h data/$BACKUP_NAME | cut -f1)"
echo ""

# ─── 2. Rsync source (protect data dir) ─────────────────────────────────────
echo "→ Syncing source code..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'apps/mobile' \
  --exclude 'apps/mobile-public' \
  --exclude 'apps/mobile-teams' \
  --exclude 'apps/web-teams' \
  --exclude 'apps/game-runtime' \
  --exclude 'apps/ai-worker' \
  --exclude 'apps/moderation-worker' \
  --exclude 'infra' \
  --exclude '.turbo' \
  --exclude 'apps/web-public/build' \
  --exclude 'apps/api-gateway/data' \
  --exclude '*.db' \
  --exclude '*.db-shm' \
  --exclude '*.db-wal' \
  -e "ssh -i $SSH_KEY" \
  "$LOCAL_DIR/" \
  "$SERVER:$REMOTE_DIR/" | tail -5
echo ""

# ─── 3. Install deps & build ────────────────────────────────────────────────
echo "→ Installing dependencies..."
$SSH_CMD "cd $REMOTE_DIR && pnpm install --no-frozen-lockfile 2>&1 | tail -3"
echo ""

echo "→ Building web-public..."
$SSH_CMD "cd $REMOTE_DIR/apps/web-public && pnpm build 2>&1 | tail -5"
echo ""

echo "→ Building web-admin..."
$SSH_CMD "cd $REMOTE_DIR/apps/web-admin && pnpm build 2>&1 | tail -5"
echo ""

# ─── 4. Restart PM2 ─────────────────────────────────────────────────────────
echo "→ Restarting services..."
$SSH_CMD "cd $REMOTE_DIR && pm2 restart all 2>&1 | tail -3"
sleep 2

# ─── 5. Health check ────────────────────────────────────────────────────────
echo ""
echo "→ Health check..."
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://secretlink.life/)
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://secretlink.life/v1/secrets/map)
echo "  Web:  $WEB_STATUS"
echo "  API:  $API_STATUS"

if [[ "$WEB_STATUS" == "200" && "$API_STATUS" == "200" ]]; then
  echo ""
  echo "✅ Deploy successful!"
else
  echo ""
  echo "⚠️  Health check failed — check PM2 logs: ssh -i $SSH_KEY $SERVER 'pm2 logs --lines 20'"
fi

# ─── 6. Show backup count ───────────────────────────────────────────────────
echo ""
echo "→ Backups on server:"
$SSH_CMD "ls -lh $REMOTE_DIR/apps/api-gateway/data/*.db 2>/dev/null | grep -v shm | grep -v wal"
