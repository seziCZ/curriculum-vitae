import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The function file keeps the __DOMAIN__ placeholder. Tests fill it in the same way Terraform does.
const src = readFileSync(
  new URL('../infra/site/functions/redirect-www.js', import.meta.url),
  'utf8',
).replaceAll('__DOMAIN__', 'example.org');
const handler = new Function(src + '\nreturn handler;')();

// These tests run the function in Node, but CloudFront runs it in its own JavaScript runtime 2.0,
// which rejects some modern syntax and then fails every request with a 503.
// CloudFront reported "SyntaxError: Token "of" not supported in this version" for a for...of loop.
test('the function uses only syntax that CloudFront Functions support', () => {
  const code = src.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\bfor\s*\([^)]*\bof\b/, 'for...of loop');
  assert.doesNotMatch(code, /\?\./, 'optional chaining ?.');
  assert.doesNotMatch(code, /\?\?/, 'nullish coalescing ??');
});

function event(host, uri, querystring = {}) {
  return {
    request: {
      uri,
      headers: { host: { value: host } },
      querystring,
    },
  };
}

test('www host redirects to the apex with 301', () => {
  const result = handler(event('www.example.org', '/'));
  assert.equal(result.statusCode, 301);
  assert.equal(result.headers.location.value, 'https://example.org/');
});

test('keeps path and query string', () => {
  const result = handler(event('www.example.org', '/a/b', {
    a: { value: '1' },
    b: { value: '2', multiValue: [{ value: '2' }, { value: '3' }] },
  }));
  assert.equal(result.headers.location.value, 'https://example.org/a/b?a=1&b=2&b=3');
});

test('apex host passes the request through', () => {
  const { request } = event('example.org', '/');
  assert.equal(handler({ request }), request);
});

test('the default cloudfront.net host redirects to the apex', () => {
  const result = handler(event('d111111abcdef8.cloudfront.net', '/about'));
  assert.equal(result.statusCode, 301);
  assert.equal(result.headers.location.value, 'https://example.org/about');
});

test('query value with an existing percent escape is not encoded twice', () => {
  const result = handler(event('www.example.org', '/', { q: { value: 'a%20b' } }));
  assert.equal(result.headers.location.value, 'https://example.org/?q=a%20b');
});

test('space in a query value is encoded as %20', () => {
  const result = handler(event('www.example.org', '/', { q: { value: 'a b' } }));
  assert.equal(result.headers.location.value, 'https://example.org/?q=a%20b');
});

test('plus sign in a query value is kept as a plus sign', () => {
  const result = handler(event('www.example.org', '/', { q: { value: 'a+b' } }));
  assert.equal(result.headers.location.value, 'https://example.org/?q=a+b');
});

test('ampersand in a query value is encoded as %26', () => {
  const result = handler(event('www.example.org', '/', { q: { value: 'x&y' } }));
  assert.equal(result.headers.location.value, 'https://example.org/?q=x%26y');
});

test('request without a host header passes through unchanged', () => {
  const request = { uri: '/', headers: {}, querystring: {} };
  assert.equal(handler({ request }), request);
});
