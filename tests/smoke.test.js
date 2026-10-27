import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene } from '../src/js/main.js';
import { leaveProgress } from '../src/js/progress.js';
import { canvasStub, seeded } from './helpers.js';

const H = 900;
const WIDTHS = [390, 1440, 1866];
// The same page layout as in the progress tests: hero 85% of the screen, About right below it.
const scroll = sy => ({ sy, H, heroH: 765, startTop: 765, endTop: 3465, endHeight: 600 });

function setup(W, { reducedMotion = false, dpr = 2, seed = 7 } = {}) {
  const log = [];
  const ctx = canvasStub(log);
  const canvas = { clientWidth: W, clientHeight: H, width: 0, height: 0, getContext: () => ctx };
  const scene = createScene(canvas, { reducedMotion, dpr, rand: seeded(seed) });
  return { log, ctx, canvas, scene, dpr };
}

// The calls made by one render.
function frame(ctx, scene, now, sy) {
  const from = ctx.calls.length;
  scene.render(now, scroll(sy));
  return ctx.calls.slice(from);
}

// Each tile is drawn as a unit square after a setTransform. Returns the tile centers in CSS pixels.
function tileCenters(calls, dpr) {
  const centers = [];
  let m = null;
  for (const call of calls) {
    if (call[0] === 'setTransform') m = call.slice(1);
    if (call[0] === 'rect' && call[1] === -.5 && call[2] === -.5 && call[3] === 1 && call[4] === 1) {
      centers.push([m[4] / dpr, m[5] / dpr]);
    }
  }
  return centers;
}

function assertNoNaN(calls) {
  for (const call of calls) {
    for (const arg of call.slice(1)) {
      if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${call[0]} got ${arg}`);
    }
  }
}

test('full scroll runs without errors', () => {
  for (const W of WIDTHS) {
    const { ctx, scene } = setup(W);
    for (let i = 0; i < 500; i++) {
      const calls = frame(ctx, scene, i * 16, i / 499 * 4000);
      assertNoNaN(calls);
    }
  }
});

test('first frame deep in the page shows the finished stack', () => {
  for (const W of [1440, 1866]) {
    const { ctx, log, scene, dpr } = setup(W);
    const calls = frame(ctx, scene, 0, 3400);
    for (const name of ['INGEST', 'GOVERN', 'ACT']) assert.ok(log.includes(name), `${name} missing at ${W}`);
    // Every stack tile is drawn at once, without the opening, and nothing else is drawn.
    const { layers } = scene.debug();
    assert.equal(tileCenters(calls, dpr).length, layers.flat().length, `tile count at ${W}`);
  }
});

test('a narrow desktop draws the finished stack without labels', () => {
  for (const reducedMotion of [false, true]) {
    const { ctx, log, scene, dpr } = setup(1024, { reducedMotion });
    frame(ctx, scene, 0, 3400);
    const calls = frame(ctx, scene, 1000, 3400);
    assert.equal(log.length, 0, `labels drawn, reduced motion ${reducedMotion}`);
    assert.equal(tileCenters(calls, dpr).length, scene.debug().layers.flat().length);
  }
});

test('resize from desktop to phone mid-scroll leaves no stray tiles', () => {
  const { ctx, canvas, scene, dpr } = setup(1440);
  let now = 0;
  for (let sy = 0; sy <= 1500; sy += 50) frame(ctx, scene, now += 100, sy);
  canvas.clientWidth = 390;
  scene.rebuild();
  let calls = [];
  for (let sy = 1500; sy <= 4000; sy += 50) calls = frame(ctx, scene, now += 100, sy);

  // On a phone every tile leaves, and no stack forms, so the last frame draws no tile at all.
  const { leaving, extras, layers } = scene.debug();
  assert.ok(leaving.length > 0);
  assert.equal(extras.length + layers.flat().length, 0, 'no stack on a phone');
  for (const tl of leaving) assert.equal(tl.size, 72, 'tiles are rebuilt for the phone');
  for (const tl of leaving) assert.equal(leaveProgress(1, tl.outDelay), 1);
  assert.equal(tileCenters(calls, dpr).length, 0, 'tiles left on the screen');
  assert.equal(canvas.width, 390 * dpr);
});

test('a phone draws nothing once the visitor reads, also with reduced motion', () => {
  for (const reducedMotion of [false, true]) {
    const { ctx, scene } = setup(390, { reducedMotion });
    frame(ctx, scene, 0, 3400);
    const calls = frame(ctx, scene, 1000, 3400);
    const paints = calls.filter(([name, , , w, h]) => ['fill', 'stroke'].includes(name) || (name === 'fillRect' && w > 0 && h > 0));
    assert.equal(paints.length, 0, `something is drawn, reduced motion ${reducedMotion}`);
  }
});

test('reduced motion draws no moving tiles', () => {
  for (const W of WIDTHS) {
    for (const sy of [0, 3400]) {
      const { ctx, scene } = setup(W, { reducedMotion: true });
      const first = frame(ctx, scene, 0, sy);
      const second = frame(ctx, scene, 5000, sy);
      assert.deepEqual(second, first, `frames differ at ${W}, sy ${sy}`);
    }
  }
});

test('reduced motion shows the whole wall at once, then fades to the stack in 300 ms', () => {
  const { ctx, log, scene, dpr } = setup(1440, { reducedMotion: true });
  const wall = tileCenters(frame(ctx, scene, 0, 0), dpr);
  assert.ok(wall.length > 0);
  assert.equal(log.length, 0, 'no labels on the wall');

  // The fade starts when About arrives: halfway, both the wall and the stack are drawn.
  frame(ctx, scene, 1000, 3400);
  const half = tileCenters(frame(ctx, scene, 1150, 3400), dpr);
  const { layers } = scene.debug();
  assert.equal(half.length, wall.length + layers.flat().length);

  // After 300 ms only the stack is left, with all 3 labels.
  log.length = 0;
  const done = tileCenters(frame(ctx, scene, 1300, 3400), dpr);
  assert.equal(done.length, layers.flat().length);
  for (const name of ['INGEST', 'GOVERN', 'ACT']) assert.ok(log.includes(name), `${name} missing`);
});

test('odd layout values give no NaN', () => {
  const { ctx, scene } = setup(1440);
  const odd = [
    { sy: 0, H, heroH: 0, startTop: 0, endTop: 0, endHeight: 0 },
    { sy: 500, H, heroH: 0, startTop: 2000, endTop: 100, endHeight: 0 },
  ];
  for (const s of odd) {
    const from = ctx.calls.length;
    scene.render(100, s);
    assertNoNaN(ctx.calls.slice(from));
  }
});
