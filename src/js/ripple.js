// A ripple in the finished stack: once in a while, one row of tiles in one layer flips over, one tile
// after the other. Each tile comes down showing a different tile: when the visitor sees it edge-on, it swaps
// its look with a hidden tile (one that left the wall or an extra of the stack), like a split-flap display.
// Pure functions with no browser APIs. Random numbers are injected.
import { clamp, ease } from './math.js';

// The pause before the next ripple is random, so the ripples do not keep a beat. The first one comes soon
// after the stack forms, so a visitor sees it before scrolling on.
export const ripplePause = (rand = Math.random, first = false) => first ? 2000 + rand() * 2000 : 5000 + rand() * 7000;
const FLIP_MS = 700;              // one tile flipping over
const STAGGER = 140;              // ms between the starts of neighboring tiles

// Everything that makes a tile look the way it does.
const LOOK = ['type', 'bg', 'fg', 'ink', 'accent', 'rot', 'rotTarget', 'data', 'dataTarget', 'bits', 'net', 'solo'];

export const rippleMs = ripple => (ripple.tiles.length - 1) * STAGGER + FLIP_MS;

// Starts a ripple along a random row or column of a random layer, in a random direction.
// hidden: the tiles that are not drawn while the stack is complete.
export function startRipple(layers, hidden, n, now, rand = Math.random) {
  const l = Math.floor(rand() * 3), alongU = rand() < .5, line = Math.floor(rand() * n);
  const along = alongU ? 'u' : 'v', across = alongU ? 'v' : 'u';
  const tiles = layers[l].filter(t => t.cell[across] === line).sort((a, b) => a.cell[along] - b.cell[along]);
  if (rand() < .5) tiles.reverse();
  // A different hidden tile for each tile in the row.
  const pool = hidden.slice();
  const spares = tiles.map(() => pool.length ? pool.splice(Math.floor(rand() * pool.length), 1)[0] : null);
  // Each tile tips over in the direction the ripple travels: the edge along it turns up.
  return { at: now, l, axis: alongU ? 0 : 2, tiles, spares, swapped: tiles.map(() => false) };
}

// The angle of the flip at time now, from 0 (flat) to PI (flat again, other face up).
const angle = (ripple, i, now) => Math.PI * ease(clamp((now - ripple.at - i * STAGGER) / FLIP_MS));

// The tile transform t turned up by theta around the edge that does not turn. The turning edge (column a)
// moves toward the vertical, which in this projection is (0, -length of the edge).
function turned(t, a, theta) {
  const m = t.slice(), len = Math.hypot(t[a], t[a + 1]);
  m[a] = Math.cos(theta) * t[a];
  m[a + 1] = Math.cos(theta) * t[a + 1] - Math.sin(theta) * len;
  return m;
}

const det = m => m[0] * m[3] - m[1] * m[2];

// The angle at which the visitor sees the tile edge-on, between 0 and PI. A 3D flip passes it exactly once.
// It is not PI / 2: in this projection a standing tile is still clearly visible.
export function edgeOnAngle(t, a) {
  const D = det(t), E = det(turned(t, a, Math.PI / 2));
  const theta = Math.atan2(D, -E);
  return theta < 0 ? theta + Math.PI : theta;
}

// Swaps the look of every tile that has passed its edge-on angle with its hidden tile. Call once per frame before drawing.
export function rippleStep(ripple, now) {
  ripple.tiles.forEach((tile, i) => {
    const spare = ripple.spares[i];
    if (ripple.swapped[i] || !spare || angle(ripple, i, now) < edgeOnAngle(tile.target, ripple.axis)) return;
    for (const k of LOOK) [tile[k], spare[k]] = [spare[k], tile[k]];
    ripple.swapped[i] = true;
  });
}

// The tiles in the air at time now, as { tile, m } with m the tile transform in CSS pixels.
// The edge along the ripple turns up and the tile lifts, so its lower edge stays on the layer.
// Past the edge-on angle the visitor sees the other face, so the turn is drawn as theta - PI: the same shape,
// with the picture the right way round. It ends exactly at the flat tile.
export function rippleParts(ripple, now) {
  const parts = [];
  ripple.tiles.forEach((tile, i) => {
    const theta = angle(ripple, i, now);
    if (theta <= 0 || theta >= Math.PI) return;
    const t = tile.target, a = ripple.axis;
    const m = turned(t, a, theta < edgeOnAngle(t, a) ? theta : theta - Math.PI);
    m[5] -= Math.sin(theta) * Math.hypot(t[a], t[a + 1]) / 2;
    parts.push({ tile, m });
  });
  return parts;
}
