import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNextEvent } from '../src/js/next-event.js';

test('no future event gives -1', () => {
  assert.equal(pickNextEvent(['2026-10-20'], '2026-10-27'), -1);
});

test('picks the earliest future event', () => {
  assert.equal(pickNextEvent(['2026-12-01', '2026-11-05', '2026-10-20'], '2026-10-27'), 1);
});

test('an event today is still next', () => {
  assert.equal(pickNextEvent(['2026-10-27'], '2026-10-27'), 0);
});
