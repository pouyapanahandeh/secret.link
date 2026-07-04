# ── S3: encrypted media blobs + Litestream SQLite replicas ───────────────────

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
    bucket_key_enabled = false
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "blobs" {
  bucket = aws_s3_bucket.blobs.id

  # Media blobs belong to ephemeral secrets; anything older than 60 days is
  # orphaned and safe to drop.
  rule {
    id     = "expire-stale-blobs"
    status = "Enabled"
    filter {
      prefix = "blobs/"
    }
    expiration {
      days = 60
    }
  }

  # Retain ~30 days of Litestream DB generations. (No-op until bucket
  # versioning is enabled; kept to mirror live config.)
  rule {
    id     = "expire-old-db-replicas"
    status = "Enabled"
    filter {
      prefix = "litestream/"
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
