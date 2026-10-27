output "state_bucket" {
  description = "Name of the bucket for the Terraform state of the main configuration."
  value       = aws_s3_bucket.state.id
}
