variable "domain" {
  description = "Apex domain of the page, for example example.com. Use lowercase, without www. and without a trailing dot."
  type        = string

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", var.domain)) && !startswith(var.domain, "www.")
    error_message = "The domain must be a lowercase hostname, without www. at the start and without a trailing dot."
  }
}

variable "alert_email" {
  description = "Email address for the cost and traffic alerts."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    error_message = "The alert email must be an email address."
  }
}

variable "mail_forwarding" {
  description = "Addresses at the domain that forward to another mailbox, as alias = target, for example { tomas = \"me@gmail.com\" }. Empty means that the domain receives no mail."
  type        = map(string)
  default     = {}
}

variable "verification_txt" {
  description = "Extra TXT values on the domain that prove ownership to a service, for example Google Search Console. Terraform manages the TXT record of the domain, so such values belong here and not in the Route 53 console."
  type        = list(string)
  default     = []
}

variable "hosted_zone_id" {
  description = "ID of the Route 53 hosted zone. When it is null, the zone is looked up by the domain name."
  type        = string
  default     = null
}

locals {
  name    = replace(var.domain, ".", "-")
  hosts   = [var.domain, "www.${var.domain}"]
  zone_id = coalesce(var.hosted_zone_id, one(data.aws_route53_zone.site[*].zone_id))
}
