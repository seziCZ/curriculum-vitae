import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The function file keeps the __DOMAIN__ placeholder. Tests fill it in the same way Terraform does.
const src = readFileSync(
  new URL('../infra/site/functions/redirect-www.js', import.meta.url),
  'utf8',
).replaceAll('__DOMAIN__', 'example.org');
const handler = new Function(src + '\nreturn handler;')();

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
  const result = handler(event('www.example.org', '/', {}));
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
  const request = event('example.org', '/', {}).request;
  const result = handler({ request });
  assert.equal(result, request);
});
