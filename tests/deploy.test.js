import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheControlFor, contentTypeFor, planUpload, readOutputs, toKey } from '../scripts/deploy.mjs';

test('content types match the spec', () => {
  assert.equal(contentTypeFor('index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('css/site.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('js/app.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('fonts/inter.woff2'), 'font/woff2');
  assert.equal(contentTypeFor('logo.svg'), 'image/svg+xml');
  assert.equal(contentTypeFor('og.png'), 'image/png');
  assert.equal(contentTypeFor('sitemap.xml'), 'application/xml');
  assert.equal(contentTypeFor('robots.txt'), 'text/plain; charset=utf-8');
  assert.equal(contentTypeFor('favicon.ico'), 'image/x-icon');
  assert.equal(contentTypeFor('site.webmanifest'), 'application/manifest+json');
  assert.equal(contentTypeFor('data.json'), 'application/json');
});

test('unknown file types get a safe default', () => {
  assert.equal(contentTypeFor('x.bin'), 'application/octet-stream');
  assert.equal(cacheControlFor('x.bin'), 'public, max-age=86400');
});

test('html, robots and sitemap are not cached', () => {
  for (const key of ['index.html', '404.html', 'robots.txt', 'sitemap.xml']) {
    assert.equal(cacheControlFor(key), 'no-cache');
  }
  assert.equal(cacheControlFor('css/site.css'), 'public, max-age=86400');
});

test('planUpload deletes only keys missing from dist', () => {
  const plan = planUpload(['index.html', 'css/site.css'], ['index.html', 'old.js']);
  assert.deepEqual(plan.deletes, ['old.js']);
  assert.equal(plan.uploads.length, 2);
  assert.deepEqual(plan.uploads[0], { key: 'index.html', contentType: 'text/html; charset=utf-8', cacheControl: 'no-cache' });
});

test('keys use forward slashes', () => {
  assert.equal(toKey('css\\site.css'), 'css/site.css');
});

test('readOutputs explains a missing apply', () => {
  assert.throws(() => readOutputs('{}'), /run "terraform apply" in infra\/site first/);
  assert.throws(() => readOutputs(''), /run "terraform apply" in infra\/site first/);
});

test('readOutputs reads the three values', () => {
  const json = JSON.stringify({
    site_url: { value: 'https://d/' },
    bucket_name: { value: 'b' },
    distribution_id: { value: 'E1' },
  });
  assert.deepEqual(readOutputs(json), { siteUrl: 'https://d/', bucket: 'b', distributionId: 'E1' });
});
