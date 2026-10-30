# sezima.dev

[![Tests](https://github.com/seziCZ/curriculum-vitae/actions/workflows/tests.yml/badge.svg)](https://github.com/seziCZ/curriculum-vitae/actions/workflows/tests.yml)

The source of my personal page, [sezima.dev](https://sezima.dev). A static site with a canvas scene, built by a Node script without a framework or a bundler, and deployed to S3 and CloudFront with Terraform.

[![The first screen: a wall of geometric tiles behind the name](docs/screenshot.png)](https://sezima.dev)

## What is in it

- **A canvas scene instead of a hero image.** The first screen is a wall of geometric tiles. When the visitor scrolls, the tiles under the text leave the screen and the rest fly into an isometric stack of three layers: Ingest, Govern, Act. Once in a while, a row of tiles in one layer flips over, one tile after the other, like a split-flap display. The geometry is plain 2D canvas code in [src/js](src/js), with no graphics library.
- **It behaves.** With `prefers-reduced-motion`, nothing flies: a still wall fades into the finished stack. On a phone, there is no stack at all, because it would cover the text. The page works without JavaScript; the scene is decoration.
- **Content from files.** Meetups live in [content/events](content/events) and posts in [content/posts](content/posts), as small JSON files. The build renders them into the page, shows the next upcoming event, hides sections that have no content yet, and counts the years in the hero from fixed start dates, so the numbers stay right in later years.
- **A version for AI agents.** The build writes `llms.txt` and `index.html.md` from the rendered page, and the page links to the Markdown version. Search engines get JSON-LD (`Person` and `ProfilePage`), a generated Open Graph image, a sitemap and robots.txt.
- **Infrastructure as code.** [infra/site](infra/site) holds the S3 bucket, the CloudFront distribution with security headers, the certificate, the DNS records, a CloudFront function that redirects `www`, a monthly budget and a traffic alarm. The deploy script uploads `dist/`, deletes files that are no longer in it, and invalidates the cache.
- **Tests without a browser.** More than a hundred tests run with `node --test` and nothing else. The canvas scene runs in the tests against a small canvas stub, so the tests can check, for example, that a flipping tile is never drawn mirrored and lands back on its cell.

## Layout

```
src/index.html      the page, with markers the build fills in
src/css, src/js     styles and the canvas scene
src/build           the build-time rendering: content, SEO, the agent version
scripts             build, serve, deploy, image generation
content             events and posts
infra               Terraform: bootstrap (state bucket) and site
tests               node:test suites
docs                the design document, the implementation plans, the deploy manual
prototypes          the HTML sketches the design started from
```

## Run it

```sh
npm ci
npm run dev     # builds into dist/ and serves it on http://127.0.0.1:8080
npm test
```

Node 20 or newer. No other tools are needed for local work. Deploying needs an AWS account, Terraform and the AWS CLI; see [docs/deploy.md](docs/deploy.md).

## How it was made

I designed and built the page together with Claude Code. The design document and the implementation plans it worked from are in [docs/superpowers](docs/superpowers), and the commits name it as co-author. Each change followed the same cycle: a failing test, the change, a look in the browser, and a line in the design document when the design changed. The page says that I use agents in my own work; this repository is one example.

## Licence

The code is under the [MIT licence](LICENSE). The texts, the images and my name are not: please do not reuse them.
