# ── IAM: EC2 instance-profile role (replaces static access keys) ─────────────
# The EC2 host assumes this role via its instance profile, so the app resolves
# AWS credentials automatically and no long-lived keys live on the box.

resource "aws_iam_role" "instance" {
  name = "secretlink-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Statement order mirrors the live inline policy so `terraform plan` is clean.
resource "aws_iam_role_policy" "app" {
  name = "secretlink-app-access"
  role = aws_iam_role.instance.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Email"
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        Sid      = "LiveVideo"
        Effect   = "Allow"
        Action   = ["ivs:CreateChannel", "ivs:GetChannel", "ivs:GetStream", "ivs:StopStream", "ivs:DeleteChannel", "ivs:GetStreamKey"]
        Resource = "*"
      },
      {
        Sid    = "Blobs"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.blobs.arn,
          "${aws_s3_bucket.blobs.arn}/*",
        ]
      },
      {
        Sid      = "Secrets"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParametersByPath"]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/secretlink/*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "instance" {
  name = "secretlink-ec2-profile"
  role = aws_iam_role.instance.name
}
