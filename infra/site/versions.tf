terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    # The name must be globally unique. If the bootstrap apply fails with BucketAlreadyExists,
    # change it here and in infra/bootstrap/main.tf.
    bucket       = "sezima-curriculum-vitae-tfstate"
    key          = "site/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
    encrypt      = true
  }
}
