variable "region" {
  description = "AWS region for the state bucket."
  type        = string
  default     = "eu-west-1"
}

variable "bucket_name" {
  description = "Name of the state bucket. When null, the name is sezima-tfstate-<account id>."
  type        = string
  default     = null
}
