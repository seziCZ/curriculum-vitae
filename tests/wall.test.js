import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWall, idleStep } from '../src/js/wall.js';
import { NET_NODES } from '../src/js/palette.js';
import { seeded } from './helpers.js';

test('wall covers the viewport', () => {
  const { tiles, size } = buildWall(1440, 900, seeded(1));
  for (let x = 0; x <= 1440; x += 20) for (let y = 0; y <= 900; y += 20) {
    const hit = tiles.some(t => Math.abs(x - t.hx) <= size / 2 && Math.abs(y - t.hy) <= size / 2);
    assert.ok(hit, `point ${x},${y} is not covered`);
  }
});

test('tile size depends on width', () => {
  assert.equal(buildWall(390, 800, seeded(1)).size, 72);
  assert.equal(buildWall(1440, 900, seeded(1)).size, 112);
});

test('tiles of a group share colors and appear together', () => {
  const { tiles } = buildWall(1440, 900, seeded(1));
  const groups = new Map();
  for (const t of tiles) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  assert.ok([...groups.values()].some(g => g.length > 1));
  for (const g of groups.values()) for (const t of g) {
    assert.equal(t.bg, g[0].bg);
    assert.equal(t.fg, g[0].fg);
    assert.equal(t.at, g[0].at);
  }
});

test('group tiles never turn', () => {
  const rand = seeded(1);
  const { tiles } = buildWall(1440, 900, rand);
  const start = new Map(tiles.map(t => [t, t.rot]));
  const state = { lastFlip: 0, lastData: 0 };
  for (let i = 1; i <= 200; i++) idleStep(tiles, i * 800, state, rand);
  let turned = 0;
  for (const t of tiles) {
    if (t.solo) { if (t.rotTarget !== start.get(t)) turned++; continue; }
    assert.equal(t.rotTarget, start.get(t));
    assert.equal(t.rot, start.get(t));
  }
  assert.ok(turned > 0);
});

test('2x2 groups form a full circle', () => {
  const { tiles, size } = buildWall(1440, 900, seeded(1));
  const groups = new Map();
  for (const t of tiles) if (!t.solo) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  const quads = [...groups.values()].filter(g => g.length === 4 && g.every(t => t.type === 'quarter'));
  assert.ok(quads.length > 0);
  for (const g of quads) {
    const xs = [...new Set(g.map(t => t.hx))].sort((a, b) => a - b);
    const ys = [...new Set(g.map(t => t.hy))].sort((a, b) => a - b);
    assert.equal(xs.length, 2);
    assert.equal(ys.length, 2);
    assert.ok(Math.abs(xs[1] - xs[0] - size) < 1e-9 && Math.abs(ys[1] - ys[0] - size) < 1e-9);
    const rotAt = (x, y) => g.find(t => t.hx === x && t.hy === y).rotTarget;
    const q = Math.PI / 2;
    assert.equal(rotAt(xs[0], ys[0]), 2 * q);
    assert.equal(rotAt(xs[1], ys[0]), 3 * q);
    assert.equal(rotAt(xs[0], ys[1]), 1 * q);
    assert.equal(rotAt(xs[1], ys[1]), 0 * q);
  }
});

test('networks use the fixed layout', () => {
  const { tiles } = buildWall(1440, 900, seeded(1));
  const nets = tiles.filter(t => t.type === 'network');
  assert.ok(nets.length > 0);
  for (const t of nets) {
    const mx = t.net.nodes[0][0] === NET_NODES[0][0] ? 1 : -1;
    t.net.nodes.forEach(([x, y], i) => {
      assert.equal(x, NET_NODES[i][0] * mx);
      assert.equal(y, NET_NODES[i][1]);
    });
  }
});
