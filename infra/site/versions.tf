# Terraform and provider versions, and the S3 backend that stores the state.
# The state bucket name is passed at init: terraform init -backend-config="bucket=<state_bucket>"
terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    key          = "site/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
    encrypt      = true
  }
}
