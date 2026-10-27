import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { normalizeSiteUrl } from '../src/build/seo.js';

const SITE = 'https://tomas.example/';

async function built() {
  const out = mkdtempSync(join(tmpdir(), 'seo-'));
  await build(out, '2026-10-27', SITE);
  return { out, html: readFileSync(join(out, 'index.html'), 'utf8') };
}

function pngSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('hex', 0, 8), '89504e470d0a1a0a', `${file} is not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const jsonLd = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

test('title says who and what', async () => {
  const { html } = await built();
  assert.match(html, /<title>Tomáš Sezima \| Data Engineering on AWS and Databricks, Brno<\/title>/);
});

test('canonical and link preview tags use the site address', async () => {
  const { html } = await built();
  assert.match(html, /<link rel="canonical" href="https:\/\/tomas\.example\/">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/tomas\.example\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/tomas\.example\/og-image\.png">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta property="og:type" content="profile">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
});

test('structured data describes the person behind the page', async () => {
  const { html } = await built();
  const graph = jsonLd(html)['@graph'];
  const byType = t => graph.find(n => n['@type'] === t);
  assert.equal(byType('WebSite').url, SITE);
  assert.equal(byType('ProfilePage').dateModified, '2026-10-27');
  const person = byType('Person');
  assert.equal(person.name, 'Tomáš Sezima');
  assert.equal(person.alternateName, 'Tomas Sezima');
  assert.equal(person.jobTitle, 'Head of Data Engineering');
  assert.deepEqual(person.sameAs, ['https://www.linkedin.com/in/sezima']);
  assert.deepEqual(person.memberOf.map(g => g.url), [
    'https://www.meetup.com/brno-aws-user-group/',
    'https://www.meetup.com/databricks-brno-user-group/',
  ]);
  assert.equal(person.image, undefined);
  assert.equal(byType('ProfilePage').mainEntity['@id'], person['@id']);
});

test('the plain spelling Tomas is visible on the page', async () => {
  const { html } = await built();
  const body = html.slice(html.indexOf('<body'));
  assert.match(body, /Tomáš \(Tomas\) Sezima/);
});

test('robots.txt allows every crawler and points to the sitemap', async () => {
  const { out } = await built();
  const robots = readFileSync(join(out, 'robots.txt'), 'utf8');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /Disallow: \//);
  assert.match(robots, /^Sitemap: https:\/\/tomas\.example\/sitemap\.xml$/m);
});

test('sitemap lists the page with the build date', async () => {
  const { out } = await built();
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/tomas\.example\/<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-10-27<\/lastmod>/);
});

test('a 404 page links back home with root-relative styles', async () => {
  const { out } = await built();
  const page = readFileSync(join(out, '404.html'), 'utf8');
  assert.match(page, /href="\/css\/site\.css"/);
  assert.match(page, /href="\/"/);
});

test('favicons and the link preview image have the right sizes', async () => {
  const { out, html } = await built();
  assert.deepEqual(pngSize(join(out, 'og-image.png')), [1200, 630]);
  assert.deepEqual(pngSize(join(out, 'favicon-192.png')), [192, 192]);
  assert.deepEqual(pngSize(join(out, 'apple-touch-icon.png')), [180, 180]);
  assert.ok(existsSync(join(out, 'favicon.svg')));
  assert.match(html, /<link rel="icon" href="favicon\.svg" type="image\/svg\+xml">/);
});

test('site address gets one trailing slash and must be absolute https', () => {
  assert.equal(normalizeSiteUrl('https://tomas.example'), 'https://tomas.example/');
  assert.equal(normalizeSiteUrl('https://tomas.example/'), 'https://tomas.example/');
  assert.throws(() => normalizeSiteUrl('tomas.example'), /https/);
});
