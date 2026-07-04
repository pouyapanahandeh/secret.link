output "blob_bucket" {
  value       = aws_s3_bucket.blobs.bucket
  description = "S3 bucket for blobs and DB replicas."
}

output "instance_profile_name" {
  value       = aws_iam_instance_profile.instance.name
  description = "Attach to the EC2 host so the app gets AWS credentials via the role."
}

output "instance_role_arn" {
  value       = aws_iam_role.instance.arn
  description = "ARN of the EC2 instance role."
}

output "ssm_parameter_names" {
  value       = [for p in aws_ssm_parameter.app : p.name]
  description = "Managed SecureString parameter names (values managed out-of-band)."
}

output "ec2_public_ip" {
  value       = data.aws_instance.app.public_ip
  description = "Public IP of the (unmanaged) production host."
}
