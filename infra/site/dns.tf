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

# The domain never sends mail, so SPF and DMARC tell other mail servers to reject mail that claims
# to come from it. It receives mail only for the aliases in var.mail_forwarding: Forward Email
# (free plan, set up with these DNS records only) forwards them. Without aliases, a null MX says
# that the domain receives no mail. The CAA record lets only Amazon issue certificates for the domain.
resource "aws_route53_record" "mail_and_caa" {
  for_each = {
    txt   = { name = var.domain, type = "TXT", records = concat(["v=spf1 -all"], [for alias, to in var.mail_forwarding : "forward-email=${alias}:${to}"]) }
    dmarc = { name = "_dmarc.${var.domain}", type = "TXT", records = ["v=DMARC1; p=reject"] }
    mx    = { name = var.domain, type = "MX", records = length(var.mail_forwarding) > 0 ? ["0 mx1.forwardemail.net", "0 mx2.forwardemail.net"] : ["0 ."] }
    caa   = { name = var.domain, type = "CAA", records = ["0 issue \"amazon.com\""] }
  }

  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 3600
  records = each.value.records
}
