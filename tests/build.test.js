import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';

test('build writes the page with the hero copy and self-hosted fonts', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /I build the data platforms that products and AI agents run on\./);
  assert.match(html, /15 years of engineering, 10 of them in data, on AWS and Databricks\./);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.ok(readdirSync(join(out, 'fonts')).some(f => f.startsWith('space-grotesk') && f.endsWith('.woff2')));
  assert.ok(readdirSync(join(out, 'fonts')).some(f => f.startsWith('inter') && f.endsWith('.woff2')));
  assert.doesNotMatch(html, /[\u2013\u2014]/);
});

test('build puts one next-event slot after the Community intro', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.equal(html.match(/class="next-event"/g).length, 1);
  assert.ok(html.indexOf('class="next-event"') > html.indexOf('I help organize both groups'));
});

test('build has the 3 layer sentences as text in About', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const about = html.slice(html.indexOf('id="about"'), html.indexOf('id="work"'));
  assert.match(about, /Collect: Everything else depends on data that arrives complete and on time\./);
  assert.match(about, /Refine: AI is only as good as the data it can trust\./);
  assert.match(about, /Act: Data creates value only when it changes what people and systems do\./);
});
