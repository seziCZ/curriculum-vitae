import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWall } from '../src/js/wall.js';
import { panelFor, splitTiles, stackLayout, assignStack, LABEL_GAP, LABEL_W } from '../src/js/layout.js';
import { seeded } from './helpers.js';

const COS = Math.cos(Math.PI / 6);

function setup(W, H, seed = 3) {
  const rand = seeded(seed);
  const { tiles } = buildWall(W, H, rand);
  const panel = panelFor(W, H);
  const { kept, leaving } = splitTiles(tiles, panel, W, H, rand);
  return { rand, panel, kept, leaving };
}

test('stack group is centered with equal margins of at least 48 px', () => {
  for (const W of [1440, 1866]) {
    const H = 900;
    const { panel, kept } = setup(W, H);
    const lay = stackLayout(panel, kept.length, H);
    assert.equal(lay.labels, true, `labels at ${W}`);
    const left = lay.cx - lay.Hs * COS;
    const right = lay.cx + lay.Hs * COS + LABEL_GAP + LABEL_W;
    assert.ok(left - panel.x >= 48, `left margin at ${W}`);
    assert.ok(W - right >= 48, `right margin at ${W}`);
    assert.ok(Math.abs((left - panel.x) - (W - right)) < 1, `margins differ at ${W}`);
  }
});

// When the panel has no room for the labels next to a stack of 200 px, the stack is drawn alone, centered.
test('a narrow desktop panel drops the labels and centers a stack of at least 200 px', () => {
  for (const [W, H] of [[768, 1024], [1024, 768]]) {
    const { panel, kept } = setup(W, H);
    const lay = stackLayout(panel, kept.length, H);
    const width = 2 * lay.Hs * COS;
    assert.equal(lay.labels, false, `labels at ${W}x${H}`);
    assert.ok(width >= 200, `stack width ${width} at ${W}x${H}`);
    const left = lay.cx - width / 2 - panel.x, right = panel.x + panel.w - (lay.cx + width / 2);
    assert.ok(left >= 48 && Math.abs(left - right) < 1, `margins ${left}, ${right} at ${W}x${H}`);
  }
});

test('the phone stack has no labels', () => {
  const { panel, kept } = setup(390, 800);
  assert.equal(stackLayout(panel, kept.length, 800).labels, false);
});

test('every leaving tile finishes when the hero has scrolled away', () => {
  for (const [W, H] of [[390, 800], [1440, 900], [1866, 900]]) {
    const { leaving } = setup(W, H);
    assert.ok(leaving.length > 0);
    for (const t of leaving) assert.ok(t.outDelay <= .4, `outDelay ${t.outDelay} at ${W}`);
  }
});

test('tiles right of the panel fly right', () => {
  const W = 1866, H = 900;
  const { panel, leaving } = setup(W, H);
  const right = leaving.filter(t => t.hx > panel.x + panel.w);
  assert.ok(right.length > 0);
  for (const t of right) assert.ok(t.out[0] > t.hx);
});

test('stack never needs more tiles than the panel keeps', () => {
  for (const [W, H] of [[390, 800], [1024, 900], [1440, 900], [1866, 900]]) {
    const { rand, panel, kept } = setup(W, H);
    const lay = stackLayout(panel, kept.length, H);
    const { layers, extras } = assignStack(kept, lay, rand);
    assert.ok(3 * lay.n * lay.n <= kept.length);
    assert.equal(extras.length, kept.length - 3 * lay.n * lay.n);
    assert.equal(layers.flat().length, 3 * lay.n * lay.n);
    for (const t of kept) assert.equal(t.target.length, 6);
  }
});

test('phone panel is a band under the menu', () => {
  assert.deepEqual(panelFor(390, 800), { x: 0, y: 56, w: 390, h: 240, mobile: true });
});
