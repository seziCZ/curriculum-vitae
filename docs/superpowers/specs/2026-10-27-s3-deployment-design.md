# Deployment of the personal page to AWS: design

Date: 2026-10-27
Depends on: `docs/superpowers/specs/2026-10-27-personal-page-design.md` (the front end, already built). The build writes plain static files to `dist/` and reads the public address from the `SITE_URL` environment variable.

## 1. Intent

Put the page online on Tomáš's own domain, with HTTPS, at almost no cost. Keep it simple: one person deploys from a laptop with one command. All infrastructure is defined in Terraform, so it can be recreated or removed at any time.

## 2. Goals, non-goals, anti-goals

Goals:
- The page is served at `https://<domain>/` with a valid certificate. `https://www.<domain>/` and plain `http://` redirect there with status 301.
- Running costs fit the AWS Free Tier. The only expected fixed cost is the Route 53 hosted zone (about $0.50 per month), which already exists.
- Deploying a new version is one command: `npm run deploy`.
- The Terraform state is stored in S3.

Non-goals:
- No CI pipeline. Tomáš deploys from his laptop.
- No domain registration. The domain and its hosted zone are created outside this design.
- No CloudFront flat-rate plan, no WAF and no logging. The only monitoring is two free alerts by email (section 4.2).

Anti-goals (the deployment fails if any of these is true, even if the page loads):
- The S3 bucket of the page is publicly readable.
- Missing pages return status 200 (search engines treat that as a "soft 404").
- A deploy leaves visitors with stale HTML for hours.
- A resource with a monthly fee is created by default.

## 3. Constraints

- AWS region for the buckets: `eu-west-1` (Ireland). The ACM certificate must be in `us-east-1`, because CloudFront requires it there.
- Terraform 1.10 or newer, because the S3 backend uses its own lock file (`use_lockfile = true`), so no DynamoDB table is needed. AWS provider version 6 (or the newest major version when the work starts).
- AWS credentials come from a named AWS CLI profile on the laptop. Nothing secret is committed.
- The hosted zone for the domain already exists in the same AWS account.
- Costs (checked October 2026): CloudFront has a permanent free tier of 1 TB of data out and 10 million requests per month; public ACM certificates are free; CloudFront Functions include 2 million free calls per month; Route 53 alias records to CloudFront are free to query; S3 storage and requests for a page of about 0.5 MB cost at most a few cents per month.

## 4. Decided design

### 4.1 One-time setup: `infra/bootstrap`

A small Terraform configuration with local state. It creates one S3 bucket for the Terraform state of the main configuration:
- versioning on, so an older state can be restored
- default encryption (SSE-S3)
- all public access blocked
- `prevent_destroy`, so it is not deleted by accident

Its local state file stays on the laptop and is ignored by Git, like every Terraform state and plan file, because state can contain account details. The bucket has the fixed name `sezima-curriculum-vitae-tfstate`, and the backend of `infra/site` uses the same name. The name must be globally unique, so if it is taken, it is changed in both places.

### 4.2 Main configuration: `infra/site`

The state is stored in the bootstrap bucket (S3 backend, `use_lockfile = true`, `encrypt = true`).

Inputs, set in `infra/site/terraform.tfvars`, which is committed:
- `domain` (for example `sezima.example`), the apex domain of the page
- `hosted_zone_id` (or a lookup of the zone by `domain`)

There is no `region` input. The region is fixed to `eu-west-1`.

Resources:
1. **Site bucket** in `eu-west-1`: private, all public access blocked, default encryption, no versioning (the content is rebuilt from Git at any time). Its bucket policy allows reading only by the CloudFront distribution, through Origin Access Control (OAC).
2. **ACM certificate** in `us-east-1` for `domain` and `www.domain`, validated by DNS records in the hosted zone.
3. **CloudFront distribution**:
   - origin: the site bucket through OAC (the REST endpoint, not the S3 website endpoint)
   - aliases: `domain` and `www.domain`, with the ACM certificate, TLS 1.2 minimum
   - viewer protocol policy: redirect HTTP to HTTPS
   - default root object: `index.html`
   - cache policy: the AWS managed `CachingOptimized`, with compression on (gzip and Brotli)
   - response headers policy: a custom policy with a strict Content-Security-Policy (`default-src 'none'`, scripts, styles, images and fonts only from the site, inline styles and `data:` images allowed), HSTS with subdomains, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that turns off camera, microphone and location. A build test checks that the pages stay within the policy.
   - custom error responses: S3 returns 403 for a missing object when CloudFront has no list permission, so both 403 and 404 are answered with `/404.html` and status 404
   - price class: `PriceClass_100` (North America and Europe), which is enough for the audience
   - IPv6 on
4. **CloudFront Function** (viewer request): when the host header is anything other than `domain` (`www.domain`, or the default `*.cloudfront.net` host), it answers with a 301 redirect to `https://domain` plus the same path and query string. Requests for `domain`, or without a Host header, pass through.
5. **Route 53 records** in the existing zone: A and AAAA alias records for `domain` and for `www.domain`, both pointing to the distribution. The domain never sends email, so it gets `v=spf1 -all` and a DMARC record with `p=reject`: nobody can send mail that claims to come from it. It receives mail only for the aliases in `mail_forwarding` (in `terraform.tfvars`, today `tomas@sezima.dev` to Gmail). Forward Email forwards them on its free plan, set up with DNS records only: two MX records and a `forward-email=alias:target` TXT value. Without aliases, a null MX (`0 .`) says that the domain receives no mail. A CAA record allows only Amazon to issue certificates.
6. **Alerts**: an AWS Budgets cost budget for the account and a CloudWatch alarm on CloudFront requests, both sending email to `alert_email` (set in `terraform.tfvars`). The alarm uses an SNS topic in `us-east-1`, where CloudFront metrics live.

Outputs: `site_url` (`https://domain/`), `bucket_name`, `distribution_id`.

### 4.3 Deploy: `npm run deploy`

A Node script `scripts/deploy.mjs`, run from the laptop:
1. Reads the outputs of `infra/site` (`terraform output -json`).
2. Runs the build with `SITE_URL` set to `site_url`. The build already writes canonical, link preview, `robots.txt` and the sitemap from it.
3. Uploads `dist/` to the site bucket and deletes objects that are no longer in `dist/`. Each file gets an explicit `Content-Type`; it must not rely on guessing. At least: `.html` `text/html; charset=utf-8`, `.css` `text/css; charset=utf-8`, `.js` `text/javascript; charset=utf-8`, `.woff2` `font/woff2`, `.svg` `image/svg+xml`, `.png` `image/png`, `.xml` `application/xml`, `.txt` `text/plain; charset=utf-8`.
4. Sets `Cache-Control`: `no-cache` for `.html`, `robots.txt` and `sitemap.xml` (the browser checks for a new version on every visit); `public, max-age=86400` for everything else (the file names are not fingerprinted, so one day is the safe limit).
5. Creates one CloudFront invalidation for `/*`. One path per deploy is far below the 1,000 free invalidation paths per month.
6. Prints the URL.

The AWS profile comes from the `AWS_PROFILE` environment variable, which the AWS CLI and Terraform both read.

### 4.4 Order of first use

0. Check that the domain is delegated to the hosted zone: the name servers that `nslookup -type=NS <domain>` (or `dig NS <domain>`) returns must be the four name servers of the zone. With a domain registered in Route 53 this is automatic. Without delegation, the certificate validation in step 2 waits until it times out.
1. `infra/bootstrap`: `terraform init` and `terraform apply` once.
2. `infra/site`: set the domain in `infra/site/terraform.tfvars` and commit it, then `terraform init` and `terraform apply`. Certificate validation can take a few minutes.
3. `npm run deploy`.
4. Outside this design: verify the domain in Google Search Console and Bing Webmaster Tools, run Google's Rich Results Test and LinkedIn's Post Inspector.

## 5. Calls I made (Tomáš did not decide these explicitly)

- The address without `www` is the main one; `www` redirects to it.
- The pay-as-you-go pricing is used, not the CloudFront flat-rate "Free plan". For this page the normal pricing is already about $0, and it is simpler to define in Terraform.
- `PriceClass_100`, because the audience is in Europe and North America.
- No access logs, to keep it simple and free. A cost budget (email above $2 actual or $10 forecast per month) and a CloudWatch alarm on CloudFront requests (more than 300,000 per day) report unusual cost or traffic; both are free.
- One day of browser caching for CSS, JavaScript, fonts and images. HTML is checked on every visit.
- No Terraform state file is committed to Git.
- The upload is a Node script that calls the AWS CLI, so the content types and cache headers are set explicitly per file type.
- The hosted zone has no records yet for `domain` or `www.domain` (the domain is not bought yet). Terraform does not overwrite existing records (no `allow_overwrite`): if one exists, `terraform apply` stops with an error and nothing old is deleted.
- The domain is delegated to the hosted zone before the first `terraform apply` (step 0 in 4.4).

## 6. Left to the builder

- The file layout inside `infra/bootstrap` and `infra/site`, and the variable names, as long as the inputs in 4.2 exist.
- Whether the upload uses `aws s3 sync` per file type or `aws s3 cp` per file.
- How `README` documents the steps in 4.4.
- Tests: Terraform `validate` and `fmt -check`, and unit tests for the content-type and cache rules of the deploy script (pure functions). Nothing is deployed to AWS during automated tests.
