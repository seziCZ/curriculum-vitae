# Values that the deploy script reads.
output "site_url" {
  description = "Address of the page."
  value       = "https://${var.domain}/"
}

output "bucket_name" {
  description = "Name of the site bucket."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "ID of the CloudFront distribution, used for cache invalidation."
  value       = aws_cloudfront_distribution.site.id
}
