# Curriculum vitae

This is my personal page. It is a static site that a Node script builds into `dist/`, and a second script deploys it to S3 and CloudFront.

Prerequisites: Node 20 or newer, Terraform 1.10 or newer, AWS CLI v2, and an AWS CLI profile for the account with the hosted zone.

## Local work

```powershell
npm install
npm run dev     # builds and serves the page locally
npm test
```

The images come from `node scripts/make-images.mjs`. Run it only when the images must change.

## First deploy

```powershell
$env:AWS_PROFILE = "<profile>"
```

Every new terminal needs this line again.

0. Check that the domain is delegated to its Route 53 hosted zone. If you registered the domain in Route 53, this is automatic. Otherwise, the name servers of the domain must be the four name servers of the zone:

   ```powershell
   nslookup -type=NS <domain>
   aws route53 get-hosted-zone --id <zone id> --query DelegationSet.NameServers
   ```

   Without delegation, the certificate validation in step 2 stops after 20 minutes.

   Registering a domain in Route 53 can create a second hosted zone with the same name. Keep the zone whose name servers the domain uses. Delete the other zone (it costs $0.50 per month), or set `hosted_zone_id` in `terraform.tfvars`.

1. Create the bucket for the Terraform state. This is done once.

   ```powershell
   terraform -chdir=infra/bootstrap init
   terraform -chdir=infra/bootstrap apply
   ```

   If the apply fails with BucketAlreadyExists, the name is taken. Change it in `infra/bootstrap/main.tf` and in `infra/site/versions.tf`.

   Then commit `infra/bootstrap/terraform.tfstate`:

   ```powershell
   git add infra/bootstrap/terraform.tfstate
   git commit -m "Add the Terraform state of the bootstrap"
   ```

2. Set the domain and create the site.

   ```powershell
   Copy-Item infra/site/terraform.tfvars.example infra/site/terraform.tfvars
   ```

   Fill in the domain in `infra/site/terraform.tfvars`. Then commit the file and create the site:

   ```powershell
   git add infra/site/terraform.tfvars
   git commit -m "Set the domain of the page"
   terraform -chdir=infra/site init
   terraform -chdir=infra/site apply
   ```

   Terraform finds the hosted zone by the domain name. If the hosted zone is for a parent domain (for example, the page is cv.example.com and the zone is example.com), set `hosted_zone_id`.

   The first apply takes several minutes, mostly for CloudFront.

3. Deploy the page. A deploy takes about a minute.

   ```powershell
   npm run deploy
   ```

4. Outside this repository: verify the domain in Google Search Console and Bing Webmaster Tools. Then run Google's Rich Results Test and LinkedIn's Post Inspector.

## Later deploys

```powershell
$env:AWS_PROFILE = "<profile>"
npm run deploy
```

Every new terminal needs the first line again. The script reads the Terraform outputs and builds the page with the real address. Then it uploads `dist/`, deletes files that are no longer in it, and invalidates the CloudFront cache.

## Tear down

`terraform destroy` in `infra/site` fails while the site bucket has files. Empty it first:

```powershell
aws s3 rm "s3://$(terraform -chdir=infra/site output -raw bucket_name)" --recursive
terraform -chdir=infra/site destroy
```

The bootstrap bucket is protected with `prevent_destroy`, so Terraform refuses to delete it. This is on purpose, because it holds the state of the site.
