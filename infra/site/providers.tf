# Every resource gets these tags, so the console and the cost reports show what belongs to the page.
locals {
  tags = {
    Project   = "curriculum-vitae"
    ManagedBy = "terraform"
    Repo      = "github.com/seziCZ/curriculum-vitae"
  }
}

# The default provider works in the main region. CloudFront needs its certificate in us-east-1, and its
# metrics live there too, so a second provider with an alias serves the certificate and the traffic alarm.
# The credentials come from the AWS_PROFILE environment variable.
provider "aws" {
  region = "eu-west-1"

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}
