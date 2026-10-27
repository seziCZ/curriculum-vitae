import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePost, renderPosts, renderPage } from '../src/build/content.js';

const mk = (date, extra = {}) => ({ date, text: `Post ${date}`, url: 'https://www.linkedin.com/posts/x-' + date, ...extra });
const template = readFileSync('src/index.html', 'utf8');

test('renderPosts shows only the 3 newest posts', () => {
  const html = renderPosts([mk('2026-01-01'), mk('2026-04-01'), mk('2026-03-01'), mk('2026-02-01')]);
  assert.equal((html.match(/class="card"/g) || []).length, 3);
  assert.ok(html.includes('Post 2026-04-01') && html.includes('Post 2026-03-01') && html.includes('Post 2026-02-01'));
  assert.ok(!html.includes('Post 2026-01-01'));
  assert.match(html, /View on LinkedIn &rarr;/);
});
test('renderPosts renders an optional image and escapes text', () => {
  const html = renderPosts([mk('2026-04-01', { image: 'a.png', text: '<b>&' })]);
  assert.match(html, /<img src="posts\/a\.png"/);
  assert.ok(html.includes('&lt;b&gt;&amp;'));
});
test('validatePost requires date, text and a linkedin.com url', () => {
  assert.deepEqual(validatePost(mk('2026-04-01')), []);
  assert.ok(validatePost({}).length >= 3);
  assert.ok(validatePost({ ...mk('2026-04-01'), date: '1.4.2026' }).some(e => e.includes('date')));
  assert.ok(validatePost({ ...mk('2026-04-01'), text: ' ' }).some(e => e.includes('text')));
  assert.ok(validatePost({ ...mk('2026-04-01'), url: 'https://example.com/x' }).some(e => e.includes('url')));
  assert.ok(validatePost({ ...mk('2026-04-01'), url: 'https://evil.com/?linkedin.com' }).some(e => e.includes('url')));
});
test('renderPage removes posts section and nav link when there are no posts', () => {
  const html = renderPage(template, { events: [], posts: [], today: '2026-10-27' });
  assert.ok(!html.includes('id="posts"'));
  assert.ok(!html.includes('href="#posts"'));
  assert.ok(!html.includes('<!--@'));
});
test('renderPage keeps posts when there are some', () => {
  const html = renderPage(template, { events: [], posts: [mk('2026-04-01')], today: '2026-10-27' });
  assert.ok(html.includes('id="posts"'));
  assert.ok(html.includes('href="#posts"'));
  assert.ok(html.includes('Post 2026-04-01'));
  assert.ok(!html.includes('<!--@') && !html.includes('<!--/@'));
});
test('validatePost rejects dates that do not exist', () => {
  for (const date of ['2026-13-01', '2026-02-30', '2026-00-10', '2026-04-31']) {
    assert.ok(validatePost(mk(date)).some(e => e.includes('date')), date);
  }
  assert.deepEqual(validatePost(mk('2028-02-29')), []);
});
