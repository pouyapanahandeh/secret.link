#!/usr/bin/env bash
# One-time / on-demand secret rotation for Secretlink.
#
# This:
#   1. Generates fresh app secrets (JWT, SESSION, MASTER_KEY, VAPID).
#   2. Pushes them to AWS SSM Parameter Store as SecureString parameters.
#   3. (Optional) rotates the leaked IAM access key.
#
# Prerequisites: `aws login` / valid AWS session, awscli v2, Node 20+.
#
#   ./scripts/rotate-secrets.sh
#
# After running, redeploy so the server pulls the new values from SSM.
set -euo pipefail

REGION="${AWS_REGION:-eu-north-1}"
PREFIX="${SSM_PREFIX:-/secretlink/prod}"
LEAKED_KEY_ID="${LEAKED_KEY_ID:-REDACTED_AWS_ACCESS_KEY_ID}"
IAM_USER="${IAM_USER:-}"

echo "──── Secretlink secret rotation ────"
aws sts get-caller-identity >/dev/null || {
  echo "No valid AWS session. Run 'aws login' first." >&2
  exit 1
}

echo "→ Generating fresh secrets..."
tmp_env="$(mktemp)"
node "$(dirname "$0")/gen-secrets.mjs" > "$tmp_env"

put() {
  local key="$1" val="$2"
  aws ssm put-parameter \
    --name "${PREFIX}/${key}" \
    --value "$val" \
    --type SecureString \
    --overwrite \
    --region "$REGION" >/dev/null
  echo "  put ${PREFIX}/${key}"
}

echo "→ Writing secrets to SSM (${PREFIX})..."
while IFS='=' read -r key val; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  put "$key" "$val"
done < "$tmp_env"
rm -f "$tmp_env"

# Non-secret config parameters (idempotent).
put RP_ID "secretlink.life"
put RP_ORIGIN "https://secretlink.life,https://admin.secretlink.life"
put CORS_ORIGINS "https://secretlink.life,https://admin.secretlink.life"
put SES_FROM "hello@secretlink.life"
put STORAGE_DRIVER "s3"
put BLOB_BUCKET "${BLOB_BUCKET:-secretlink-blobs}"

# ── Rotate the leaked IAM access key (only if an IAM user is provided) ────────
if [[ -n "$IAM_USER" ]]; then
  echo "→ Deactivating leaked access key ${LEAKED_KEY_ID} for ${IAM_USER}..."
  aws iam update-access-key --user-name "$IAM_USER" --access-key-id "$LEAKED_KEY_ID" --status Inactive --region "$REGION" || true
  echo "  Key deactivated. Verify the app still works (via instance role), then delete it:"
  echo "    aws iam delete-access-key --user-name $IAM_USER --access-key-id $LEAKED_KEY_ID"
else
  echo "! IAM_USER not set — skipping IAM key rotation."
  echo "  Prefer removing static keys entirely and attaching an EC2 instance role."
  echo "  To rotate manually: IAM_USER=<user> ./scripts/rotate-secrets.sh"
fi

echo "✅ Rotation complete. Redeploy to apply."
