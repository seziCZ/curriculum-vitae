import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWall } from '../src/js/wall.js';
import { readFileSync } from 'node:fs';
import { panelFor, splitTiles, stackLayout, assignStack, textRightFor, LABEL_GAP, LABEL_W } from '../src/js/layout.js';
import { seeded } from './helpers.js';

const COS = Math.cos(Math.PI / 6);

function setup(W, H, seed = 3) {
  const rand = seeded(seed);
  const { tiles } = buildWall(W, H, rand);
  const panel = panelFor(W, H);
  const { kept, leaving } = splitTiles(tiles, panel, W, H, rand);
  return { rand, panel, kept, leaving };
}

// On a wide screen the text column takes 60% (see site.css), and the group sits in the middle of the
// space right of the text: the gap after the text equals the margin after the labels.
test('on a wide screen the stack group sits centered between the text edge and the right edge', () => {
  for (const [W, H] of [[1280, 800], [1440, 900], [1920, 1080]]) {
    const { panel, kept } = setup(W, H);
    const lay = stackLayout(panel, kept.length, H);
    assert.equal(lay.labels, true, `labels at ${W}`);
    const left = lay.cx - lay.Hs * COS;
    const right = lay.cx + lay.Hs * COS + LABEL_GAP + LABEL_W;
    const gap = left - textRightFor(W);
    assert.ok(gap >= 48, `gap ${gap} at ${W}`);
    assert.ok(Math.abs(gap - (W - right)) < 1, `gap ${gap} and right margin ${W - right} differ at ${W}`);
  }
});

test('the text column ends at the page margin plus min(42vw, 640px)', () => {
  assert.equal(textRightFor(1440), 72 + 1440 * .42);
  assert.equal(textRightFor(1920), 80 + 640);
});

// site.css draws the text column; layout.js must place the stack against the same numbers.
test('site.css uses the same breakpoint, margin and text cap as layout.js', () => {
  const css = readFileSync('src/css/site.css', 'utf8');
  assert.match(css, /@media \(min-width:1280px\)/);
  assert.match(css, /--m:clamp\(16px,5vw,80px\)/);
  assert.match(css, /--cap:min\(42vw,640px\)/);
});

test('the stack is at most 61.8% of the screen height', () => {
  for (const [W, H] of [[1920, 1080], [1440, 900], [1024, 768]]) {
    const { panel, kept } = setup(W, H);
    const lay = stackLayout(panel, kept.length, H);
    const total = lay.Hs * (1 + 2 * .62 + .07);
    assert.ok(total <= .618 * H + 1e-9, `stack ${total} of ${H} at ${W}`);
  }
});

test('below 1280 px the stack group is centered with equal margins of at least 48 px', () => {
  const W = 1200, H = 900;
  const { panel, kept } = setup(W, H);
  const lay = stackLayout(panel, kept.length, H);
  assert.equal(lay.labels, true);
  const left = lay.cx - lay.Hs * COS;
  const right = lay.cx + lay.Hs * COS + LABEL_GAP + LABEL_W;
  assert.ok(left - panel.x >= 48 && Math.abs((left - panel.x) - (W - right)) < 1, `margins ${left - panel.x}, ${W - right}`);
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
  for (const [W, H] of [[1024, 900], [1440, 900], [1866, 900]]) {
    const { rand, panel, kept } = setup(W, H);
    const lay = stackLayout(panel, kept.length, H);
    const { layers, extras } = assignStack(kept, lay, rand);
    assert.ok(3 * lay.n * lay.n <= kept.length);
    assert.equal(extras.length, kept.length - 3 * lay.n * lay.n);
    assert.equal(layers.flat().length, 3 * lay.n * lay.n);
    for (const t of kept) assert.equal(t.target.length, 6);
  }
});

test('phone panel is empty, so every tile leaves and no stack forms', () => {
  assert.deepEqual(panelFor(390, 800), { x: 0, y: 56, w: 390, h: 0, mobile: true });
  const { kept } = setup(390, 800);
  assert.equal(kept.length, 0);
});
