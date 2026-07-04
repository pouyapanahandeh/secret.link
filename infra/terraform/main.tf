# Secretlink AWS infrastructure (eu-north-1).
#
# Captures the resources the app depends on so they are reproducible:
#   - S3 bucket for encrypted blobs + SQLite replicas (Litestream)
#   - IAM instance-profile role for the EC2 host (no static keys on the box)
#   - SSM parameters are written by scripts/rotate-secrets.sh (SecureString)
#
# The (pre-existing, manually created) EC2 instance is referenced by ID rather
# than managed, to avoid Terraform replacing the live host. Attach the instance
# profile with: aws ec2 associate-iam-instance-profile.

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "eu-north-1"
}

variable "blob_bucket_name" {
  type    = string
  default = "secretlink-blobs-455155948605"
}

# ── S3: blobs + DB replicas ───────────────────────────────────────────────────
resource "aws_s3_bucket" "blobs" {
  bucket = var.blob_bucket_name
}

resource "aws_s3_bucket_public_access_block" "blobs" {
  bucket                  = aws_s3_bucket.blobs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "blobs" {
  bucket = aws_s3_bucket.blobs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "blobs" {
  bucket = aws_s3_bucket.blobs.id

  # Blobs belong to ephemeral secrets; anything older than 60 days is orphaned.
  rule {
    id     = "expire-stale-blobs"
    status = "Enabled"
    filter { prefix = "blobs/" }
    expiration { days = 60 }
  }

  # Keep 30 days of Litestream DB generations.
  rule {
    id     = "expire-old-db-replicas"
    status = "Enabled"
    filter { prefix = "litestream/" }
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
}

# ── IAM: EC2 instance role (replaces static access keys) ─────────────────────
resource "aws_iam_role" "instance" {
  name = "secretlink-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "app" {
  name = "secretlink-app-access"
  role = aws_iam_role.instance.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Blobs"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [aws_s3_bucket.blobs.arn, "${aws_s3_bucket.blobs.arn}/*"]
      },
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
        Sid      = "Secrets"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParametersByPath"]
        Resource = "arn:aws:ssm:${var.region}:*:parameter/secretlink/*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "instance" {
  name = "secretlink-ec2-profile"
  role = aws_iam_role.instance.name
}

output "instance_profile_name" {
  value = aws_iam_instance_profile.instance.name
}

output "blob_bucket" {
  value = aws_s3_bucket.blobs.bucket
}
