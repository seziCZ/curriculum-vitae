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
  assert.match(html, /15 years of engineering, 10 of them in data, on AWS and Databricks\. Agentic AI is my current focus, and the part of my work I enjoy most\./);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.ok(readdirSync(join(out, 'fonts')).some(f => f.startsWith('space-grotesk') && f.endsWith('.woff2')));
  assert.ok(readdirSync(join(out, 'fonts')).some(f => f.startsWith('inter') && f.endsWith('.woff2')));
  assert.doesNotMatch(html, /[\u2013\u2014]/);
});

// The site sends a strict Content-Security-Policy (infra/site/cdn.tf): scripts only from the
// same origin, no inline scripts and no event handler attributes, no requests to other hosts.
test('the built pages work under the Content-Security-Policy', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27');
  for (const file of ['index.html', '404.html']) {
    const html = readFileSync(join(out, file), 'utf8');
    for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      const dataBlock = /type="application\/ld\+json"/.test(attrs);
      assert.ok(dataBlock || (/\ssrc="/.test(attrs) && body.trim() === ''), `${file}: inline script`);
    }
    assert.doesNotMatch(html, /\son[a-z]+="/, `${file}: event handler attribute`);
    const loaded = [
      ...html.matchAll(/<(?:script|img)\b[^>]*\ssrc="([^"]*)"/g),
      ...html.matchAll(/<link\b[^>]*\srel="(?:stylesheet|icon|apple-touch-icon|preload|modulepreload)"[^>]*\shref="([^"]*)"/g),
    ].map(m => m[1]);
    assert.ok(loaded.length > 0, `${file}: no resources found`);
    for (const url of loaded) assert.doesNotMatch(url, /^(https?:)?\/\//, `${file}: ${url} comes from another host`);
  }
});

test('the contact email is the address at the domain', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /href="mailto:tomas@sezima\.dev"/);
  assert.doesNotMatch(html, /gmail\.com/);
});

test('the current work item ends in the build year', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2027-03-15');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /2022 to 2027 · Datamole/);
  assert.doesNotMatch(html, /<!--@/);
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
  assert.match(about, /Ingest: Everything you build depends on data that arrives complete and on time\./);
  assert.match(about, /Govern: People trust data only when its meaning, quality and access are clear\./);
  assert.match(about, /Act: Apps, reports and AI agents turn this data into decisions and actions\./);
});
