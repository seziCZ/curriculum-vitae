# The Route 53 zone and the records that point the domain and www to the distribution.
data "aws_route53_zone" "site" {
  count = var.hosted_zone_id == null ? 1 : 0
  name  = var.domain
}

locals {
  zone_id = var.hosted_zone_id != null ? var.hosted_zone_id : data.aws_route53_zone.site[0].zone_id

  record_names = {
    apex = var.domain
    www  = "www.${var.domain}"
  }
}

resource "aws_route53_record" "alias_a" {
  for_each = local.record_names

  zone_id = local.zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "alias_aaaa" {
  for_each = local.record_names

  zone_id = local.zone_id
  name    = each.value
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
