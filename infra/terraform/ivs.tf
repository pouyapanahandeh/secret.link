# ── Amazon IVS (eu-west-1) ───────────────────────────────────────────────────
# NOTE ON SCOPE: IVS channels are created dynamically by the API at runtime,
# one per broadcasting user (see apps/api-gateway/src/services/ivs.ts). They are
# application DATA, not shared infrastructure — the actual "IVS infra" is just
# the ivs:* permissions on the instance role (see iam.tf).
#
# The two channels below already existed when this config was written. We import
# them so the state is captured, but with prevent_destroy + ignore_changes so
# Terraform never deletes or fights the app over user channels. New per-user
# channels are intentionally NOT tracked here.

resource "aws_ivs_channel" "existing" {
  for_each = {
    "sl-pooya" = "arn:aws:ivs:eu-west-1:455155948605:channel/5BCg22P3wQqT"
    "sl-waac"  = "arn:aws:ivs:eu-west-1:455155948605:channel/eBlL1RKc3G7W"
  }

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
