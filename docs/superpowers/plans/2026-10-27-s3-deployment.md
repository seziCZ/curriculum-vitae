# AWS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terraform for an S3 plus CloudFront site with HTTPS on an existing Route 53 zone, state in S3, and a one-command deploy from the laptop.

**Architecture:** Two Terraform root modules: `infra/bootstrap` (local state, creates the state bucket) and `infra/site` (S3 backend, creates bucket, OAC, ACM, CloudFront, a www-redirect CloudFront Function and Route 53 records). A Node script `scripts/deploy.mjs` reads the Terraform outputs, runs the existing build with `SITE_URL`, uploads files with explicit headers through the AWS CLI, deletes stale objects and invalidates CloudFront. Nothing touches AWS during automated tests.

**Tech Stack:** Terraform 1.16 (minimum 1.10), AWS provider `~> 6.0`, AWS CLI v2, Node 25 (`node:test`, `node:child_process`).

**Spec:** `docs/superpowers/specs/2026-10-27-s3-deployment-design.md`

## Global Constraints

- Buckets in `eu-west-1`; the ACM certificate in `us-east-1` (spec 3).
- `required_version = ">= 1.10"`; AWS provider `~> 6.0`; S3 backend with `use_lockfile = true` and `encrypt = true`; no DynamoDB (spec 3, 4.2).
- Credentials only from the AWS CLI profile (`AWS_PROFILE`); nothing secret committed (spec 3).
- No resource with a monthly fee is created; no WAF, logging, monitoring or flat-rate plan (spec 2, 5).
- The site bucket is never public; only the distribution reads it through OAC (spec 2, 4.2).
- Route 53 records never use `allow_overwrite` (spec 5).
- Missing pages answer `/404.html` with status 404, for both 403 and 404 from S3 (spec 4.2).
- `PriceClass_100`, TLS minimum `TLSv1.2_2021`, IPv6 on, managed policies `Managed-CachingOptimized` and `Managed-SecurityHeadersPolicy` looked up by name (spec 4.2).
- Plain English in comments and docs, no en dashes or em dashes anywhere.

## Review Focus

1. `www` request with a path and query string (`https://www.d/a?b=1`): 301 to `https://d/a?b=1`, keeping a multi-value query intact. Test: Task 2 `keeps path and query string`.
2. A file type the deploy script does not know (for example `.ico` or `.webmanifest` added later): it must still upload with a safe type (`application/octet-stream`) and the default cache rule, not crash. Test: Task 4 `unknown file types get a safe default`.
3. A deploy after files were removed from `dist/`: stale objects are deleted, but nothing outside the bucket's site keys is touched. Test: Task 4 `planUpload deletes only keys missing from dist`.
4. Windows paths in `dist/` (`css\site.css`): S3 keys must use `/`. Test: Task 4 `keys use forward slashes`.
5. Running the deploy before `terraform apply` (no outputs): a clear error that names the missing step, not a stack trace from JSON parsing. Test: Task 4 `readOutputs explains a missing apply`.

---

## File Structure

```
.gitignore                             add .terraform/ and *.tfplan; keep infra/bootstrap/terraform.tfstate tracked
infra/bootstrap/versions.tf            terraform and provider versions
infra/bootstrap/main.tf                state bucket with versioning, encryption, public access block, prevent_destroy
infra/bootstrap/variables.tf           region, bucket_name (the AWS profile comes from AWS_PROFILE, spec 4.3)
infra/bootstrap/outputs.tf             state_bucket
infra/site/versions.tf                 versions and the partial S3 backend
infra/site/providers.tf                default provider eu-west-1, alias us_east_1
infra/site/variables.tf                domain, hosted_zone_id (optional), region
infra/site/bucket.tf                   site bucket, public access block, encryption, bucket policy for OAC
infra/site/certificate.tf              ACM certificate in us-east-1 and DNS validation
infra/site/cdn.tf                      OAC, CloudFront Function, distribution
infra/site/dns.tf                      zone lookup, A and AAAA alias records
infra/site/outputs.tf                  site_url, bucket_name, distribution_id
infra/site/functions/redirect-www.js   CloudFront Function (JavaScript runtime 2.0)
scripts/deploy.mjs                     deploy orchestration plus pure helpers
tests/redirect-www.test.js             unit tests for the function
tests/deploy.test.js                   unit tests for the pure helpers
README.md                              first-use steps and deploy
```

---

### Task 1: Bootstrap state bucket

**Files:**
- Create: `infra/bootstrap/versions.tf`, `main.tf`, `variables.tf`, `outputs.tf`
- Modify: `.gitignore`

**Interfaces:**
- Produces: output `state_bucket` (string). Variables `region` (default `"eu-west-1"`) and `bucket_name` (default `null`; when null the name is `"sezima-tfstate-${data.aws_caller_identity.current.account_id}"`).

- [ ] **Step 1: Write the configuration.** `aws_s3_bucket` with `lifecycle { prevent_destroy = true }`; `aws_s3_bucket_versioning` (`Enabled`); `aws_s3_bucket_server_side_encryption_configuration` (`AES256`); `aws_s3_bucket_public_access_block` with all four flags `true`. Provider `aws` with `region = var.region` and no profile argument.
- [ ] **Step 2: Update `.gitignore`**: add `.terraform/` and `*.tfplan`. Do not ignore `infra/bootstrap/terraform.tfstate` (spec 5: committed) and do not ignore `.terraform.lock.hcl`.
- [ ] **Step 3: Verify.** Run in `infra/bootstrap`: `terraform fmt -check -recursive` (expected: no output, exit 0), `terraform init -backend=false` then `terraform validate` (expected: `Success! The configuration is valid.`). Commit `.terraform.lock.hcl`.
- [ ] **Step 4: Commit** `git add .gitignore infra/bootstrap` then `git commit -m "Add Terraform bootstrap for the state bucket"`

---

### Task 2: www redirect function

**Files:**
- Create: `infra/site/functions/redirect-www.js`, `tests/redirect-www.test.js`

**Interfaces:**
- Produces: a CloudFront Functions JavaScript 2.0 file defining `function handler(event)` with the placeholder `__DOMAIN__` for the apex domain. Task 3 loads it with `templatefile` (or `replace`) to insert the domain. The file has no `export`, because CloudFront Functions do not use modules.

- [ ] **Step 1: Write the failing tests.** Load the file text, replace `__DOMAIN__` with `example.org`, and get the handler with `new Function(src + '\nreturn handler;')()`. Events use the CloudFront shape `{ request: { uri, headers: { host: { value } }, querystring: { a: { value: '1' }, b: { value: '2', multiValue: [{ value: '2' }, { value: '3' }] } } } }`.
  - `www host redirects to the apex with 301`: host `www.example.org`, uri `/`, no query: result `statusCode === 301`, `headers.location.value === 'https://example.org/'`.
  - `keeps path and query string`: uri `/a/b`, query `a=1`, `b=2` and `b=3`: location is `https://example.org/a/b?a=1&b=2&b=3`.
  - `apex host passes the request through`: host `example.org`: the handler returns the same `request` object.
- [ ] **Step 2: Run** `node --test tests/redirect-www.test.js`. Expected: FAIL, file not found.
- [ ] **Step 3: Implement** `handler(event)`: compare the lowercased host with `'www.__DOMAIN__'`; build the query string from `request.querystring`, using `multiValue` when present and encoding keys and values with `encodeURIComponent`.
- [ ] **Step 4: Run** `node --test tests/redirect-www.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `git add infra/site/functions tests/redirect-www.test.js` then `git commit -m "Add the www to apex redirect function"`

---

### Task 3: Site infrastructure

**Files:**
- Create: `infra/site/versions.tf`, `providers.tf`, `variables.tf`, `bucket.tf`, `certificate.tf`, `cdn.tf`, `dns.tf`, `outputs.tf`

**Interfaces:**
- Consumes: `infra/site/functions/redirect-www.js` with `__DOMAIN__` (Task 2).
- Produces: outputs `site_url` (`"https://${var.domain}/"`), `bucket_name`, `distribution_id`. Variables: `domain` (string, required, validated as a lowercase hostname without `www.` and without a trailing dot), `hosted_zone_id` (string, default `null`: when null, `data.aws_route53_zone` looks the zone up by `var.domain`), `region` (default `"eu-west-1"`).
- Backend: `backend "s3" { key = "site/terraform.tfstate"  region = "eu-west-1"  use_lockfile = true  encrypt = true }`; the bucket is passed at init with `-backend-config="bucket=<state_bucket>"`.

- [ ] **Step 1: Write the configuration** per spec 4.2:
  - Bucket: name `"${replace(var.domain, ".", "-")}-site-${account_id}"`; public access block all `true`; SSE `AES256`; bucket policy allowing `s3:GetObject` on `arn/*` to principal `cloudfront.amazonaws.com` with condition `AWS:SourceArn` equal to the distribution ARN.
  - Certificate: `aws_acm_certificate` with `provider = aws.us_east_1`, `domain_name = var.domain`, `subject_alternative_names = ["www.${var.domain}"]`, `validation_method = "DNS"`, `create_before_destroy`; validation records with `for_each` over `domain_validation_options` (no `allow_overwrite`); `aws_acm_certificate_validation`.
  - CDN: `aws_cloudfront_origin_access_control` (`s3`, `always`, `sigv4`); `aws_cloudfront_function` (`cloudfront-js-2.0`, `publish = true`, code from the file with `__DOMAIN__` replaced); `aws_cloudfront_distribution` with the constraints in Global Constraints, `aliases = [var.domain, "www.${var.domain}"]`, `viewer_certificate` from the validation resource, `default_root_object = "index.html"`, `compress = true`, function association on `viewer-request`, `custom_error_response` for 403 and 404 with `response_code = 404` and `response_page_path = "/404.html"`, `restrictions { geo_restriction { restriction_type = "none" } }`.
  - DNS: `aws_route53_record` A and AAAA alias for `var.domain` and `www.${var.domain}` to the distribution (`evaluate_target_health = false`), no `allow_overwrite`.
- [ ] **Step 2: Verify.** In `infra/site`: `terraform fmt -check -recursive` (no output), `terraform init -backend=false` and `terraform validate` (`Success! The configuration is valid.`). Do not run `terraform plan` or `apply`, because they need AWS credentials. Instead, check the configuration against every Global Constraint and list each one with the file and line that satisfies it in the report.
- [ ] **Step 3: Commit** `git add infra/site` then `git commit -m "Add Terraform for bucket, certificate, CloudFront and DNS"`

---

### Task 4: Deploy script and README

**Files:**
- Create: `scripts/deploy.mjs`, `tests/deploy.test.js`, `README.md`
- Modify: `package.json` (script `"deploy": "node scripts/deploy.mjs"`)

**Interfaces:**
- Consumes: `build(outDir, today, siteUrl)` from `scripts/build.mjs`; outputs `site_url`, `bucket_name`, `distribution_id` (Task 3).
- Produces, exported from `scripts/deploy.mjs` (pure, no AWS calls):
  - `contentTypeFor(key: string) -> string` with exactly the map in spec 4.3 plus `.ico` `image/x-icon`, `.webmanifest` `application/manifest+json`, `.json` `application/json`; anything else `application/octet-stream`.
  - `cacheControlFor(key: string) -> string`: `'no-cache'` for `.html`, `robots.txt`, `sitemap.xml`; `'public, max-age=86400'` otherwise.
  - `planUpload(localKeys: string[], remoteKeys: string[]) -> { uploads: { key, contentType, cacheControl }[], deletes: string[] }`.
  - `toKey(relativePath: string) -> string` (forward slashes).
  - `readOutputs(json: string) -> { siteUrl, bucket, distributionId }`, throwing `Error` with the text `run "terraform apply" in infra/site first` when an output is missing or the text is empty.
- The script body (only when run directly): `terraform -chdir=infra/site output -json`, `build('dist', today, siteUrl)`, `aws s3 cp` per upload with `--content-type` and `--cache-control`, `aws s3 rm` per delete (remote keys from `aws s3api list-objects-v2 --bucket B --query "Contents[].Key" --output json`, `null` meaning empty), `aws cloudfront create-invalidation --distribution-id D --paths "/*"`, then print the site URL. Child processes with `execFileSync`, `stdio` inherited for the AWS output, and an error with the failed command when one exits non-zero.

- [ ] **Step 1: Write the failing tests** in `tests/deploy.test.js`: `content types match the spec` (one assertion per extension in spec 4.3), `unknown file types get a safe default` (`x.bin` gives `application/octet-stream` and `public, max-age=86400`), `html, robots and sitemap are not cached` (also `404.html`), `planUpload deletes only keys missing from dist` (local `['index.html','css/site.css']`, remote `['index.html','old.js']`: deletes `['old.js']`, 2 uploads), `keys use forward slashes` (`toKey('css\\site.css') === 'css/site.css'`), `readOutputs explains a missing apply` (`readOutputs('{}')` and `readOutputs('')` throw with that text), `readOutputs reads the three values` (a `terraform output -json` sample with `{ "site_url": { "value": "https://d/" }, ... }`).
- [ ] **Step 2: Run** `node --test tests/deploy.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the helpers and the script body.
- [ ] **Step 4: Run** `npm test`. Expected: all tests PASS (59 existing plus the new ones).
- [ ] **Step 5: Write `README.md`**: what the project is (2 sentences), local work (`npm install`, `npm run dev`, `npm test`), the first-use steps 0 to 4 from spec 4.4 with the exact commands (PowerShell and Bash variants where they differ, `AWS_PROFILE`, `terraform -chdir=infra/bootstrap output -raw state_bucket` passed to `-backend-config`), and `npm run deploy`. Mention `node scripts/make-images.mjs` for the images.
- [ ] **Step 6: Commit** `git add scripts/deploy.mjs tests/deploy.test.js README.md package.json` then `git commit -m "Add the deploy script and README"`
