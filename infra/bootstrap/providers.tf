provider "aws" {
  region = "eu-west-1"

  # Every resource gets these tags, so the console and the cost reports show what belongs to the page.
  default_tags {
    tags = {
      Project   = "curriculum-vitae"
      ManagedBy = "terraform"
      Repo      = "github.com/seziCZ/curriculum-vitae"
    }
  }
}
