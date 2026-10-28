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

test('the years of experience count from 2011 and 2016 to the build year', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2027-03-15');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /16 years of engineering, 11 of them in data, on AWS and Databricks\./);
});

test('ongoing work items end in the build year', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2027-03-15');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /2024 to 2027 · Datamole/);
  assert.match(html, /2018 to 2027 · Datamole/);
  assert.doesNotMatch(html, /<!--@/);
});

test('About names the actor model and AWS, and no team size', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /I have built data systems since 2016: Spark, Kafka and Cassandra at Honeywell, and an event-driven IoT platform on the actor model at Atos\. At Datamole, I build data platforms on AWS and Databricks\. I hired and grew two data engineering teams\./);
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

test('the Datamole work items name their scale', async () => {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /so the team could focus on what the operators needed from their data\. The platform now processes the data of public transport networks in 19 countries\.<\/p>/);
  assert.match(html, /<p>Electron microscopes produce large amounts of data\. I built one cloud-native platform for predictive analytics on this data, from 50\+ AWS services defined fully in code with CDK\. Today it connects hundreds of microscopes\. I also hired and grew the first team of 5\.<\/p>/);
});
