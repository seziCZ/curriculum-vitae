# Inputs of the site configuration.
variable "domain" {
  description = "Apex domain of the page, for example example.com. Use lowercase, without www. and without a trailing dot."
  type        = string

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", var.domain)) && !startswith(var.domain, "www.")
    error_message = "The domain must be a lowercase hostname, without www. at the start and without a trailing dot."
  }
}

variable "hosted_zone_id" {
  description = "ID of the Route 53 hosted zone. When it is null, the zone is looked up by the domain name."
  type        = string
  default     = null
}

variable "region" {
  description = "AWS region for the site bucket."
  type        = string
  default     = "eu-west-1"
}
