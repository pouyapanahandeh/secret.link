# ── Amazon IVS (eu-west-1) ───────────────────────────────────────────────────
# NOTE ON SCOPE: IVS channels are created dynamically by the API at runtime,
# one per broadcasting user (see apps/api-gateway/src/services/ivs.ts). They are
# application DATA, not shared infrastructure — the actual "IVS infra" is just
# the ivs:* permissions on the instance role (see iam.tf).
#
# Pre-existing channels are optional. Pass name => ARN pairs through
# var.existing_ivs_channels (gitignored terraform.tfvars). prevent_destroy and
# ignore_changes keep Terraform from fighting the app over user channels.
# New per-user channels are intentionally NOT tracked here.

resource "aws_ivs_channel" "existing" {
  for_each = var.existing_ivs_channels

  provider = aws.ivs

  name         = each.key
  type         = "BASIC"
  latency_mode = "LOW"
  authorized   = false

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}
