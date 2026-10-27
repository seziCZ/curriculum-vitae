resource "aws_acm_certificate" "site" {
  provider = aws.us_east_1

  domain_name               = local.hosts[0]
  subject_alternative_names = [local.hosts[1]]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = { for option in aws_acm_certificate.site.domain_validation_options : option.domain_name => option }

  zone_id = local.zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "site" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]

  # Without delegation the validation never succeeds, and the default wait is 75 minutes.
  timeouts {
    create = "20m"
  }
}
