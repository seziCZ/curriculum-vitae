import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollPhases, tileProgress, slabAlpha, reducedPhases, releaseOffset } from '../src/js/progress.js';

const LAYOUT = { H: 900, heroH: 765, startTop: 765, endTop: 3465, endHeight: 600 };

function at(sy, layout = LAYOUT) {
  return scrollPhases({ sy, ...layout });
}

function firstScrollWhere(predicate, from = 0, to = 4000) {
  for (let sy = from; sy <= to; sy++) {
    if (predicate(sy)) return sy;
  }
  throw new Error('no scroll position matches');
}

test('nothing moves at the top', () => {
  const p = at(0);
  assert.equal(p.a, 0);
  assert.equal(p.b, 0);
  assert.equal(p.build, 0);
  assert.deepEqual(p.labels, [0, 0, 0]);
});

test('stack is complete before the first label', () => {
  const sy = firstScrollWhere(s => at(s).labels[0] > 0);
  const { build } = at(sy);
  assert.equal(tileProgress(build, .31), 1);
  assert.equal(slabAlpha(build), 1);
});

test('labels appear in order', () => {
  const first0 = firstScrollWhere(s => at(s).labels[0] > 0);
  const first1 = firstScrollWhere(s => at(s).labels[1] > 0);
  const first2 = firstScrollWhere(s => at(s).labels[2] > 0);
  assert.ok(first1 > first0, 'label 1 appears after label 0');
  assert.ok(first2 > first1, 'label 2 appears after label 1');
});

test('labels finish at the end of the given end section', () => {
  const layout = { ...LAYOUT, endTop: 2865, endHeight: 600 };
  const sy = 2865 + 600 - 720;
  assert.equal(at(sy, layout).labels[2], 1);
});

test('phases depend only on the scroll position', () => {
  assert.deepEqual(at(1234), at(1234));
  const late = at(3400);
  assert.deepEqual(late.labels, [1, 1, 1]);
});

test('reduced motion shows the stack from About on', () => {
  assert.equal(reducedPhases({ sy: 0, H: 900, startTop: 765 }).stack, false);
  assert.equal(reducedPhases({ sy: 404, H: 900, startTop: 765 }).stack, false);
  assert.equal(reducedPhases({ sy: 405, H: 900, startTop: 765 }).stack, true);
});

// The wall stays pinned while the visitor reads. Once Contact enters the screen, it scrolls away with the page,
// so it never sits next to Contact.
test('the wall scrolls away with the page once Contact enters the screen', () => {
  const contactTop = 4200, H = 900;
  assert.equal(releaseOffset(0, contactTop, H), 0);
  assert.equal(releaseOffset(contactTop - H, contactTop, H), 0);
  assert.equal(releaseOffset(contactTop - H + 250, contactTop, H), 250);
  assert.equal(releaseOffset(contactTop, contactTop, H), H);
});
