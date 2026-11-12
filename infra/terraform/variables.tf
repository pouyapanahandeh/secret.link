variable "region" {
  type        = string
  default     = "eu-north-1"
  description = "Primary region for S3, SSM, SES, and the EC2 host."
}

variable "ivs_region" {
  type        = string
  default     = "eu-west-1"
  description = "Region where Amazon IVS channels live."
}

variable "blob_bucket_name" {
  type        = string
  description = "S3 bucket for encrypted media blobs and Litestream DB replicas. Set this in a gitignored terraform.tfvars file."
}

variable "instance_id" {
  type        = string
  description = "Existing EC2 host id. Referenced as a data source and never managed by Terraform. Set this in a gitignored terraform.tfvars file."
}

variable "existing_ivs_channels" {
  type        = map(string)
  default     = {}
  description = "Optional map of channel name to ARN for channels that already exist. Leave empty in git. Real ARNs belong in gitignored terraform.tfvars."
}

# SSM parameter names under /secretlink/prod. Values are NEVER set from
# Terraform (see ssm.tf): they are managed out-of-band by scripts/rotate-secrets.sh
# and their drift is ignored. This list only declares which keys exist.
variable "ssm_parameter_names" {
  type = list(string)
  default = [
    "JWT_SECRET",
    "SESSION_SECRET",
    "MASTER_KEY",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "RP_ID",
    "RP_ORIGIN",
    "CORS_ORIGINS",
    "SES_FROM",
    "STORAGE_DRIVER",
    "BLOB_BUCKET",
  ]
  description = "Names (without the /secretlink/prod/ prefix) of the app's SecureString parameters."
}
