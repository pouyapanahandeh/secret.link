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
  default     = "secretlink-blobs-455155948605"
  description = "S3 bucket for encrypted media blobs and Litestream DB replicas."
}

variable "instance_id" {
  type        = string
  default     = "i-08bbb720d0765cf19"
  description = "Existing EC2 host. Referenced (data source) — never managed/replaced by Terraform."
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
