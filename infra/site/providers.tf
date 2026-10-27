# The default provider works in the main region. CloudFront needs its certificate in us-east-1,
# so a second provider with an alias is used for the certificate only.
# The credentials come from the AWS_PROFILE environment variable.
provider "aws" {
  region = "eu-west-1"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
