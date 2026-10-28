import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { cacheControlFor, contentTypeFor } from '../scripts/deploy.mjs';

const SITE = 'https://sezima.dev/';

async function built() {
  const out = mkdtempSync(join(tmpdir(), 'page-'));
  await build(out, '2026-10-27', SITE);
  const read = f => readFileSync(join(out, f), 'utf8');
  return { html: read('index.html'), md: read('index.html.md'), llms: read('llms.txt') };
}

test('llms.txt names the person, the claim and links the Markdown page and the contacts', async () => {
  const { llms } = await built();
  assert.ok(llms.startsWith('# Tomáš Sezima\n\n> I build the data platforms that products and AI agents run on.\n'));
  assert.match(llms, /Head of Data Engineering at Datamole, Brno\. 15 years of engineering, 10 of them in data/);
  assert.match(llms, /\[Profile in Markdown\]\(https:\/\/sezima\.dev\/index\.html\.md\)/);
  assert.match(llms, /\[LinkedIn\]\(https:\/\/www\.linkedin\.com\/in\/sezima\)/);
  assert.match(llms, /\[Email\]\(mailto:tomas@sezima\.dev\)/);
});

test('the Markdown page has the hero, the sections and the work items', async () => {
  const { md } = await built();
  assert.ok(md.startsWith('# Tomáš Sezima\n\n**I build the data platforms that products and AI agents run on.**\n'));
  for (const h of ['## About', '## Selected work', '## Community', '## Contact']) assert.ok(md.includes(`\n${h}\n`), h);
  assert.ok(!md.includes('**Selected work.**'), 'a heading that repeats its section is left out');
  assert.match(md, /### A data product for public transport\n\n\*2024 to 2026 · Datamole\*\n\nTransport operators needed reliable data/);
  assert.match(md, /Tags: Databricks, Lakeflow, AWS/);
  assert.match(md, /- Ingest: Everything you build depends on data that arrives complete and on time\./);
});

test('the Markdown page lists the meetups with their talks and speakers', async () => {
  const { md } = await built();
  assert.match(md, /### Building with GenAI & Autonomous Agents\n\n\*5 Feb 2026 · AWS Brno #1\*\n\nGEN Digital, Vlněna 7/);
  assert.match(md, /- "The Curious Case of Generative AI" by Tomáš Sezima\n- "Accelerating Software Development with Kiro and autonomous agent" by Sanjay Kashalkar, AWS/);
  assert.match(md, /\[Event page\]\(https:\/\/luma\.com\/m1tedor5\)/);
});

test('the Markdown page is clean text with absolute links', async () => {
  const { md } = await built();
  assert.doesNotMatch(md, /<[a-z/!]/i, 'no HTML');
  assert.doesNotMatch(md, /&[a-z#0-9]+;/i, 'no HTML entities');
  assert.doesNotMatch(md, /Scroll|Speaker/, 'no page furniture');
  assert.doesNotMatch(md, /\]\((?!https:\/\/|mailto:)/, 'every link is absolute');
  assert.doesNotMatch(md, /\n{3,}/);
  assert.doesNotMatch(md, /[–—]/);
  assert.match(md, /\[LinkedIn\]\(https:\/\/www\.linkedin\.com\/in\/sezima\)/);
  assert.match(md, /Markdown version of https:\/\/sezima\.dev\/, built on 2026-10-27\./);
});

test('the page points agents to the Markdown version', async () => {
  const { html } = await built();
  assert.match(html, /<link rel="alternate" type="text\/markdown" href="index\.html\.md">/);
});

test('the agent files are served as text and not cached', () => {
  assert.equal(contentTypeFor('index.html.md'), 'text/markdown; charset=utf-8');
  assert.equal(contentTypeFor('llms.txt'), 'text/plain; charset=utf-8');
  assert.equal(cacheControlFor('index.html.md'), 'no-cache');
  assert.equal(cacheControlFor('llms.txt'), 'no-cache');
});
