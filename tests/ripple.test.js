import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeOnAngle, rippleMs, rippleParts, ripplePause, rippleStep, startRipple } from '../src/js/ripple.js';
import { createScene } from '../src/js/main.js';
import { canvasStub, seeded } from './helpers.js';

const det = m => m[0] * m[3] - m[1] * m[2];
// A layer of 3 x 3 stack tiles, with the isometric tile transform the stack uses.
const tile = (u, v, look) => ({ cell: { l: 0, u, v }, target: [26, 15, -26, 15, 300 + (u - v) * 26, 200 + (u + v) * 15], type: look, bg: look });
const layer = () => [0, 1, 2].flatMap(u => [0, 1, 2].map(v => tile(u, v, `t${u}${v}`)));
const hiddenTiles = k => Array.from({ length: k }, (_, i) => ({ cell: null, target: [1, 0, 0, 1, 0, 0], type: `h${i}`, bg: `h${i}` }));

test('a ripple runs along one row or column of one layer, with a different hidden tile for each tile', () => {
  const rand = seeded(4);
  for (let s = 0; s < 30; s++) {
    const layers = [layer(), layer(), layer()];
    const r = startRipple(layers, hiddenTiles(5), 3, 0, rand);
    assert.equal(r.tiles.length, 3);
    assert.ok(r.tiles.every(t => layers[r.l].includes(t)));
    const across = r.axis === 0 ? 'v' : 'u', along = r.axis === 0 ? 'u' : 'v';
    assert.equal(new Set(r.tiles.map(t => t.cell[across])).size, 1, 'one line');
    const steps = r.tiles.map(t => t.cell[along]);
    assert.ok(steps.join() === '0,1,2' || steps.join() === '2,1,0', `in order: ${steps}`);
    assert.equal(new Set(r.spares).size, 3);
  }
});

test('the edge-on angle is where the tile has no area on screen', () => {
  for (const a of [0, 2]) {
    const t = tile(0, 0).target, theta = edgeOnAngle(t, a);
    assert.ok(theta > 0 && theta < Math.PI);
    assert.notEqual(Math.round(theta * 100), Math.round(Math.PI / 2 * 100), 'not at 90 degrees in this projection');
    const r = { at: 0, axis: a, tiles: [{ ...tile(0, 0), target: t }], spares: [null], swapped: [false] };
    // Sample the flip: the smallest area seen is close to zero.
    let least = Infinity;
    for (let ms = 1; ms < rippleMs(r); ms++) for (const { m } of rippleParts(r, ms)) least = Math.min(least, Math.abs(det(m)) / det(t));
    assert.ok(least < .02, `least area ${least}`);
  }
});

test('a flipping tile is never drawn mirrored, never sinks into its layer and lands where it started', () => {
  for (const a of [0, 2]) {
    const t = tile(1, 1).target, r = { at: 0, axis: a, tiles: [{ ...tile(1, 1), target: t }], spares: [null], swapped: [false] };
    assert.deepEqual(rippleParts(r, 0), []);
    for (let ms = 1; ms < rippleMs(r); ms += 3) {
      for (const { m } of rippleParts(r, ms)) {
        assert.ok(det(m) / det(t) >= -1e-9, `mirrored at ${ms} ms`);
        assert.ok(m[5] <= t[5] + 1e-9, `below the layer at ${ms} ms`);
      }
    }
    const end = rippleParts(r, rippleMs(r) - 1)[0].m;
    end.forEach((x, i) => assert.ok(Math.abs(x - t[i]) < 1, `lands at its cell (${i})`));
    assert.deepEqual(rippleParts(r, rippleMs(r)), []);
  }
});

test('each tile swaps its look with its hidden tile once, when it is edge-on', () => {
  const layers = [layer(), layer(), layer()], hidden = hiddenTiles(3);
  const r = startRipple(layers, hidden, 3, 0, seeded(2));
  const before = r.tiles.map(t => t.type), spareBefore = r.spares.map(s => s.type);
  const first = r.tiles[0], edge = edgeOnAngle(first.target, r.axis);
  // Just before and just after the edge-on moment of the first tile.
  let ms = 0;
  for (; ms < 700; ms++) {
    const theta = rippleParts(r, ms).find(p => p.tile === first);
    if (theta && Math.abs(det(theta.m)) / det(first.target) < .02) break;
  }
  rippleStep(r, ms - 40);
  assert.equal(first.type, before[0], 'not before edge-on');
  rippleStep(r, ms + 40);
  assert.equal(first.type, spareBefore[0]);
  assert.equal(r.spares[0].type, before[0], 'the hidden tile takes the old look, so nothing is doubled');
  rippleStep(r, rippleMs(r));
  rippleStep(r, rippleMs(r) + 100);
  assert.deepEqual(r.tiles.map(t => t.type), spareBefore, 'each tile swapped once');
  assert.ok(edge > 0);
});

test('in the scene, ripples change tile looks but every tile keeps its cell', () => {
  for (const W of [1440, 1024]) {
    const ctx = canvasStub();
    const scene = createScene({ clientWidth: W, clientHeight: 900, width: 0, height: 0, getContext: () => ctx }, { dpr: 1, rand: seeded(5) });
    const scroll = sy => ({ sy, H: 900, heroH: 765, startTop: 765, endTop: 3465, endHeight: 600 });
    const { layers } = scene.debug(), cells = layers.map(ts => ts.slice());
    const looks = () => layers.flat().map(t => t.type + t.bg + t.fg).join();
    const first = looks();
    for (let now = 0; now <= 15000; now += 16) scene.render(now, scroll(now > 9000 && now < 9500 ? 300 : 2000));
    assert.notEqual(looks(), first, `no look changed at ${W}`);
    assert.ok(layers.every((ts, l) => ts.every((t, i) => t === cells[l][i] && t.cell.l === l)));
  }
});

test('the pause between ripples is random: 2 to 4 s before the first, then 5 to 12 s', () => {
  const rand = seeded(8), firsts = [], laters = [];
  for (let i = 0; i < 200; i++) { firsts.push(ripplePause(rand, true)); laters.push(ripplePause(rand)); }
  assert.ok(firsts.every(p => p >= 2000 && p <= 4000));
  assert.ok(laters.every(p => p >= 5000 && p <= 12000));
  assert.ok(Math.max(...laters) - Math.min(...laters) > 5000, 'spread over the range');
});
