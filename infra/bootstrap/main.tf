# Creates the S3 bucket that holds the Terraform state of the main configuration.
# This module keeps its own state locally and is applied once, by hand.

resource "aws_s3_bucket" "state" {
  # The name must be globally unique. If the apply fails with BucketAlreadyExists,
  # change it here and in the backend block in infra/site/versions.tf.
  bucket = "sezima-curriculum-vitae-tfstate"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
