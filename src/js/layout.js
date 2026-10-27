// Geometry of the split layout: the panel, the tiles that leave and the isometric stack.
// Pure functions with no browser APIs. Random numbers are injected.
import { clamp } from './math.js';

export const NAV = 56;
export const LABEL_GAP = 46;
export const LABEL_W = 220;
export const PANEL_MARGIN = 48;
export const MOBILE_BREAK = 760;

const COS = Math.cos(Math.PI / 6);
const SIN = .5;

// The panel is where the wall lives once the visitor starts reading:
// the right half on a desktop, a band under the menu on a phone.
// On a phone the panel is empty: every tile leaves while the hero scrolls away, and no stack forms,
// because a stack in a band under the menu would cover the text without adding anything.
export function panelFor(W, H) {
  return W < MOBILE_BREAK
    ? { x: 0, y: NAV, w: W, h: 0, mobile: true }
    : { x: W * .5, y: 0, w: W * .5, h: H, mobile: false };
}

// Each leaving tile takes the shortest way out. Tiles at the edges leave first, so none of them stays behind.
export function splitTiles(tiles, panel, W, H, rand = Math.random) {
  const rnd = (a, b) => a + rand() * (b - a);
  const inPanel = tl => tl.hx >= panel.x && tl.hx <= panel.x + panel.w && tl.hy >= panel.y && tl.hy <= panel.y + panel.h;
  const kept = tiles.filter(inPanel);
  const leaving = tiles.filter(tl => !inPanel(tl));
  const right = panel.x + panel.w, bottom = panel.y + panel.h;
  leaving.forEach(tl => {
    if (tl.hx > right) { tl.outDelay = 0; tl.out = [tl.hx + W * .3, tl.hy]; }
    else if (tl.hy < panel.y) { tl.outDelay = 0; tl.out = [tl.hx, tl.hy - H * .3]; }
    else if (panel.mobile || tl.hy > bottom) {
      const below = clamp((tl.hy - bottom) / (H - bottom));
      tl.outDelay = (1 - below) * .4; tl.out = [tl.hx + rnd(-30, 30), tl.hy + H * .6];
    } else {
      tl.outDelay = clamp(tl.hx / panel.x) * .4; tl.out = [tl.hx - W * .5 + rnd(-30, 30), tl.hy];
    }
  });
  return { kept, leaving };
}

// The narrowest stack that is drawn next to the labels. A narrower panel shows the stack alone.
export const MIN_STACK_W = 200;

// On a desktop, the stack and its labels are one group, centered in the panel with a margin on both sides.
// When that group leaves less than MIN_STACK_W for the stack (tablets, narrow windows), labels is false:
// the stack alone fills the panel width without the margins and is centered. A phone has no labels either.
// The panel is kept in the result because the extra tiles need it.
export function stackLayout(panel, keptCount, H) {
  const n = Math.max(2, Math.floor(Math.sqrt(keptCount / 3)));
  const labelSpace = LABEL_GAP + LABEL_W;
  const labels = !panel.mobile && panel.w - 2 * PANEL_MARGIN - labelSpace >= MIN_STACK_W;
  const room = panel.mobile ? panel.w * .5 : panel.w - 2 * PANEL_MARGIN - (labels ? labelSpace : 0);
  const Hs = Math.min(room / (2 * COS), panel.h * .8 / 2.4);
  const c = Hs / n, L = Hs * .62, T = Hs * .07;
  const hw = Hs * COS;
  const cx = labels ? panel.x + (panel.w - (2 * hw + labelSpace)) / 2 + hw : panel.x + panel.w / 2;
  const total = Hs + 2 * L + T;
  const cy = panel.mobile ? panel.y + panel.h / 2 : (H + NAV) / 2;
  const y0 = cy - total / 2;
  return { n, c, Hs, T, cx, cy, tops: [y0 + 2 * L, y0 + L, y0], panel, labels };
}

// The first 3 * n * n tiles (in random order) fill the three layers. The rest fly outward from the stack center.
export function assignStack(kept, lay, rand = Math.random) {
  const rnd = (a, b) => a + rand() * (b - a);
  const { n, c, cx, cy, panel } = lay;
  const order = kept.slice().sort(() => rand() - .5);
  const extras = [], layers = [[], [], []];
  order.forEach((tl, i) => {
    if (i < 3 * n * n) {
      const l = Math.floor(i / (n * n)), k = i % (n * n), u = k % n, v = Math.floor(k / n);
      const g = .94;
      tl.cell = { l, u, v };
      tl.delay = l * .08 + rnd(0, .15);
      tl.target = [c * COS * g, c * SIN * g, -c * COS * g, c * SIN * g,
        cx + (u - v) * c * COS, lay.tops[l] + (u + v + 1) * c * SIN];
      layers[l].push(tl);
    } else {
      tl.cell = null;
      tl.delay = rnd(0, .1);
      const dx = tl.hx - cx, dy = tl.hy - cy, d = Math.hypot(dx, dy) || 1;
      tl.target = [tl.size * .3, 0, 0, tl.size * .3, tl.hx + dx / d * panel.w * .6, tl.hy + dy / d * panel.h * .6];
      extras.push(tl);
    }
  });
  return { layers, extras };
}

export function slabPoints(lay, l) {
  const hw = lay.n * lay.c * COS, top = lay.tops[l];
  return { T: [lay.cx, top], R: [lay.cx + hw, top + lay.Hs / 2], B: [lay.cx, top + lay.Hs], L: [lay.cx - hw, top + lay.Hs / 2] };
}
