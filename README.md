# Curriculum vitae

This is my personal page. It is a static site that a Node script builds into `dist/`, and a second script deploys it to S3 and CloudFront.

## Local work

```powershell
npm install
npm run dev     # builds and serves the page locally
npm test
```

The images come from `node scripts/make-images.mjs`. Run it only when the images must change.

## First deploy

The commands are for PowerShell. In Bash, set the profile with `export AWS_PROFILE=<profile>` instead of `$env:AWS_PROFILE = "<profile>"`. The other commands are the same.

0. Check that the domain is delegated to its Route 53 hosted zone. The name servers from `nslookup -type=NS <domain>` must be the four name servers of the zone. Without this, the certificate validation in step 2 waits until it times out.

1. Create the bucket for the Terraform state. This is done once. The state file of this step is committed.

   ```powershell
   $env:AWS_PROFILE = "<profile>"
   terraform -chdir=infra/bootstrap init
   terraform -chdir=infra/bootstrap apply
   ```

2. Create the site. The certificate validation can take a few minutes.

   ```powershell
   $bucket = terraform -chdir=infra/bootstrap output -raw state_bucket
   terraform -chdir=infra/site init "-backend-config=bucket=$bucket"
   terraform -chdir=infra/site apply -var domain=<domain>
   ```

   In Bash: `bucket=$(terraform -chdir=infra/bootstrap output -raw state_bucket)` and `-backend-config="bucket=$bucket"`.

   `infra/site` looks the hosted zone up by the domain name. If the domain lives in a parent zone, add `-var hosted_zone_id=<zone id>` to the `apply` command.

3. Deploy the page.

   ```powershell
   npm run deploy
   ```

4. Outside this repository: verify the domain in Google Search Console and Bing Webmaster Tools, then run Google's Rich Results Test and LinkedIn's Post Inspector.

## Later deploys

Run `npm run deploy` with `AWS_PROFILE` set. The script reads the Terraform outputs, builds the page with the real address, uploads `dist/`, deletes files that are no longer in it, and invalidates the CloudFront cache.

## Tear down

`terraform destroy` in `infra/site` fails while the site bucket has files. Empty it first:

```powershell
aws s3 rm s3://<bucket> --recursive
terraform -chdir=infra/site destroy -var domain=<domain>
```

The bootstrap bucket is protected with `prevent_destroy`, so Terraform refuses to delete it. This is on purpose, because it holds the state of the site.
