data "aws_route53_zone" "site" {
  count = var.hosted_zone_id == null ? 1 : 0
  name  = var.domain
}

resource "aws_route53_record" "alias_a" {
  for_each = toset(local.hosts)

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
  for_each = toset(local.hosts)

  zone_id = local.zone_id
  name    = each.value
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# The domain sends no email, so these records tell other mail servers to reject mail that claims
# to come from it. The CAA record lets only Amazon issue certificates for the domain.
resource "aws_route53_record" "policy" {
  for_each = {
    spf   = { name = var.domain, type = "TXT", value = "v=spf1 -all" }
    dmarc = { name = "_dmarc.${var.domain}", type = "TXT", value = "v=DMARC1; p=reject" }
    mx    = { name = var.domain, type = "MX", value = "0 ." }
    caa   = { name = var.domain, type = "CAA", value = "0 issue \"amazon.com\"" }
  }

  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 3600
  records = [each.value.value]
}
