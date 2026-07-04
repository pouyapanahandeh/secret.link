# ── EC2 host (referenced, NOT managed) ───────────────────────────────────────
# The production host was created manually and runs the live app. We expose it
# as a data source for outputs/reference only. Deliberately NOT an
# `aws_instance` resource: managing it in Terraform risks an accidental
# replacement that would destroy the running server. Instance-profile
# attachment is likewise handled out-of-band (aws ec2
# associate-iam-instance-profile) to avoid touching the live host.

data "aws_instance" "app" {
  instance_id = var.instance_id
}
