# Nothing caps the CloudFront bill, so two free alerts report unusual cost or traffic by email.

# A cost budget for the whole account: an email when the actual cost of a month passes $2
# (the hosted zone alone is about $0.50) or when the forecast passes $10.
resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 2
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# CloudFront metrics live in us-east-1. The alarm fires when a day has more than 300,000 requests,
# which is the pace of the 10 million free requests per month. AWS sends a confirmation email
# for the subscription first; the alarm emails arrive only after it is confirmed.
resource "aws_sns_topic" "alerts" {
  provider = aws.us_east_1
  name     = "${local.name}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "requests" {
  provider            = aws.us_east_1
  alarm_name          = "${local.name}-requests"
  alarm_description   = "More CloudFront requests in a day than the free tier allows on average."
  namespace           = "AWS/CloudFront"
  metric_name         = "Requests"
  dimensions          = { DistributionId = aws_cloudfront_distribution.site.id, Region = "Global" }
  statistic           = "Sum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 300000
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
