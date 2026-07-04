#!/usr/bin/env bash
# Materialise a .env file from AWS SSM Parameter Store.
#
# All Secretlink secrets live under the /secretlink/prod/ prefix as SecureString
# parameters. This script pulls them and writes a .env consumable by
# ecosystem.config.cjs. Run it on the server during deploy (see deploy.sh).
#
#   ./scripts/pull-ssm-env.sh > .env
#
# Requires: awscli v2, and an IAM identity (ideally the EC2 instance role) with
# ssm:GetParametersByPath + kms:Decrypt on the parameter KMS key.
set -euo pipefail

PREFIX="${SSM_PREFIX:-/secretlink/prod}"
REGION="${AWS_REGION:-eu-north-1}"

echo "# Rendered from SSM ${PREFIX} at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

aws ssm get-parameters-by-path \
  --path "$PREFIX" \
  --with-decryption \
  --recursive \
  --region "$REGION" \
  --query "Parameters[].[Name,Value]" \
  --output text |
  while IFS=$'\t' read -r name value; do
    key="$(basename "$name")"
    printf '%s=%s\n' "$key" "$value"
  done
