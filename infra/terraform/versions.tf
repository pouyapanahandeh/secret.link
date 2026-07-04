# Secretlink AWS infrastructure — reproducible, drift-protected definition of
# the resources the running app depends on. Each file documents its own scoping
# decisions inline (see data.tf for EC2, ivs.tf for IVS, ssm.tf for secrets).
#
# Workflow:
#   export creds:  eval "$(aws configure export-credentials --format env)"
#   terraform init            # S3-backed remote state (encrypted)
#   terraform plan            # should report "No changes" against live infra
#
# State contains SSM values after import, so it lives only in the encrypted S3
# backend (never committed — see .gitignore).

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in the existing (encrypted, private) blobs bucket. Keeps the
  # state — which contains SSM secret values after import — off local disk and
  # encrypted at rest. Uses a dedicated prefix untouched by the bucket's
  # blob/litestream lifecycle rules.
  backend "s3" {
    bucket  = "secretlink-blobs-455155948605"
    key     = "terraform/secretlink.tfstate"
    region  = "eu-north-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.region
}

# IVS lives in eu-west-1 (there is no IVS endpoint in eu-north-1).
provider "aws" {
  alias  = "ivs"
  region = var.ivs_region
}

data "aws_caller_identity" "current" {}
