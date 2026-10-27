import { C, NET_NODES, NET_EDGES } from './palette.js';
import { clamp } from './math.js';

const PAL = [C.navy, C.rust, C.blue, C.pink];
const DATA_TYPES = ['griddot', 'scatter', 'pixels', 'tokens', 'network'];

// The same balanced network on every tile, sometimes mirrored for variety.
function makeNetwork(rand) {
  const mx = rand() < .5 ? -1 : 1;
  return { nodes: NET_NODES.map(([x, y]) => [x * mx, y]), edges: NET_EDGES };
}

// Fill the grid with motifs: 2x2 big circles, 2x1 pills and stripe blocks, data tiles and single tiles.
// Tiles of one motif share colors and appear together, so the bigger shapes read as one piece.
export function buildWall(W, H, rand = Math.random) {
  const rnd = (a, b) => a + rand() * (b - a);
  const pick = a => a[Math.floor(rand() * a.length)];
  const size = W < 700 ? 72 : 112;
  const cols = Math.ceil(W / size) + 1, rows = Math.ceil(H / size) + 1;
  const ox = (W - cols * size) / 2, oy = (H - rows * size) / 2;

  const tiles = [];
  let nextGroup = 0;
  const used = Array.from({ length: rows }, () => Array(cols).fill(false));
  const free = (r, c, h, w) => {
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++)
      if (r + i >= rows || c + j >= cols || used[r + i][c + j]) return false;
    return true;
  };
  const colors = () => {
    const bg = pick([C.navy, C.navy, C.navy, C.pink, C.blue, C.rust]);
    let fg; do fg = pick(PAL); while (fg === bg);
    return { bg, fg };
  };
  const add = (r, c, type, k, col, at, solo, group) => {
    used[r][c] = true;
    // data: [grid dot x, grid dot y, token index, scatter jitter x5]
    const data = [Math.floor(rnd(1, 6)), Math.floor(rnd(1, 6)), Math.floor(rnd(0, 4)), ...Array.from({ length: 5 }, rand)];
    tiles.push({ hx: ox + c * size + size / 2, hy: oy + r * size + size / 2, size, bg: col.bg, fg: col.fg,
      ink: col.bg === C.navy ? C.light : C.navy, accent: col.bg === C.rust ? C.pink : C.rust,
      type, rot: k * Math.PI / 2, rotTarget: k * Math.PI / 2, nx: rnd(-1, 1), at, solo, group,
      data, dataTarget: data.slice(), bits: Array.from({ length: 81 }, () => rand() > .3), net: makeNetwork(rand) });
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (used[r][c]) continue;
    const col = colors(), at = rnd(0, 1.8), roll = rand();
    const group = nextGroup++;
    if (roll < .1 && free(r, c, 2, 2)) {
      const big = pick(['quarter', 'rings', 'mixed']);
      [[0, 0, 2], [0, 1, 3], [1, 0, 1], [1, 1, 0]].forEach(([i, j, k], n) => {
        const type = big === 'mixed' ? (n % 3 === 0 ? 'quarter' : 'rings') : big;
        add(r + i, c + j, type, k, col, at, false, group);
      });
    } else if (roll < .22 && free(r, c, 2, 1)) {
      const type = pick(['half', 'arch', 'stripes']);
      add(r, c, type, type === 'stripes' ? 1 : 0, col, at, false, group);
      add(r + 1, c, type, type === 'stripes' ? 1 : 2, col, at, false, group);
    } else if (roll < .32 && free(r, c, 1, 2)) {
      const type = pick(['half', 'arch', 'stripes']);
      add(r, c, type, type === 'stripes' ? 0 : 3, col, at, false, group);
      add(r, c + 1, type, type === 'stripes' ? 0 : 1, col, at, false, group);
    } else if (roll < .55) {
      add(r, c, pick(DATA_TYPES), 0, col, at, false, group);
    } else {
      add(r, c, pick(['circle', 'star', 'bullseye', 'quarter', 'half', 'stripes', 'stripes']), Math.floor(rnd(0, 4)), col, at, true, group);
    }
  }
  return { size, tiles };
}

// Small, calm changes keep the wall alive: a shape turns, a data point moves, the next token is chosen.
export function idleStep(tiles, now, state, rand = Math.random) {
  const pick = a => a[Math.floor(rand() * a.length)];
  const solos = tiles.filter(tl => tl.solo);
  if (now - state.lastFlip > 700 && solos.length) { state.lastFlip = now; pick(solos).rotTarget += Math.PI / 2; }
  if (now - state.lastData > 400) {
    state.lastData = now;
    const tl = pick(tiles);
    if (tl.type === 'griddot') {
      tl.dataTarget[0] = clamp(tl.dataTarget[0] + pick([-1, 1]), 1, 5);
      tl.dataTarget[1] = clamp(tl.dataTarget[1] + pick([-1, 1]), 1, 5);
    } else if (tl.type === 'tokens') {
      if (tl.dataTarget[2] >= 3) { tl.data[2] = -.6; tl.dataTarget[2] = 0; } else tl.dataTarget[2] += 1;
    } else if (tl.type === 'scatter') {
      for (let i = 3; i < 8; i++) tl.dataTarget[i] = rand();
    }
  }
  for (const tl of tiles) {
    tl.rot += (tl.rotTarget - tl.rot) * .08;
    for (let i = 0; i < 8; i++) tl.data[i] += (tl.dataTarget[i] - tl.data[i]) * .06;
  }
}
