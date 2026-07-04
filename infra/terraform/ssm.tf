# ── SSM Parameter Store: application secrets ─────────────────────────────────
# These SecureString parameters hold the app's runtime secrets. Terraform
# tracks their EXISTENCE and type only — it never reads or writes the values:
#
#   lifecycle.ignore_changes = [value]  → Terraform won't overwrite live secrets
#   value = "MANAGED_OUTSIDE_TERRAFORM" → placeholder only used if a parameter
#                                         has to be re-created from scratch (DR),
#                                         after which rotate-secrets.sh sets the
#                                         real value.
#
# Rotation / real values are owned by scripts/rotate-secrets.sh. This keeps
# plaintext secrets out of the Terraform config (state is still encrypted in S3).

resource "aws_ssm_parameter" "app" {
  for_each = toset(var.ssm_parameter_names)

  name  = "/secretlink/prod/${each.key}"
  type  = "SecureString"
  value = "MANAGED_OUTSIDE_TERRAFORM"

  lifecycle {
    ignore_changes = [value]
  }
}
