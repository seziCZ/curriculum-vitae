// Canvas drawing of the tile wall and the isometric stack. Ported from prototypes/split-layout.html.
// Every function takes the 2D context and the device pixel ratio first. No window or document.
import { C, MUTED, LAYERS, NET_HUB } from './palette.js';
import { LABEL_GAP, LABEL_W, slabPoints } from './layout.js';
import { clamp, ease, lerp } from './math.js';
import { leaveProgress, tileProgress } from './progress.js';

const TITLE_FONT = '600 15px "Space Grotesk", sans-serif';
const TEXT_FONT = '400 14px Inter, sans-serif';

// How far a tile has grown in the opening, t seconds after the first frame.
export const growth = (t, at) => ease(clamp((t - at) / .35));

function circle(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }

function gridLines(ctx, n) {
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    const p = -.5 + i / n;
    ctx.moveTo(p, -.5); ctx.lineTo(p, .5); ctx.moveTo(-.5, p); ctx.lineTo(.5, p);
  }
  ctx.stroke();
}

// Each tile is drawn in unit coordinates from -0.5 to 0.5.
function shape(ctx, tl) {
  const { fg, bg, ink, accent, data: d } = tl;
  ctx.fillStyle = fg; ctx.strokeStyle = fg; ctx.lineWidth = .022;
  switch (tl.type) {
    case 'quarter':
      ctx.beginPath(); ctx.moveTo(-.5, -.5); ctx.arc(-.5, -.5, 1, 0, Math.PI / 2); ctx.closePath(); ctx.fill(); break;
    case 'half':
      ctx.beginPath(); ctx.arc(0, .5, .5, Math.PI, 0); ctx.closePath(); ctx.fill(); break;
    case 'circle':
      ctx.beginPath(); ctx.arc(0, 0, .4, 0, 7); ctx.fill(); break;
    case 'rings':
      for (let r = .1; r < 1.01; r += .1) { ctx.beginPath(); ctx.arc(-.5, -.5, r, 0, Math.PI / 2); ctx.stroke(); } break;
    case 'stripes':
      for (let y = -.5 + .045; y < .5; y += .075) { ctx.beginPath(); ctx.moveTo(-.5, y); ctx.lineTo(.5, y); ctx.stroke(); } break;
    case 'star':
      ctx.fillRect(-.5, -.5, 1, 1); ctx.fillStyle = bg;
      for (const [x, y] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]]) { ctx.beginPath(); ctx.arc(x, y, .5, 0, 7); ctx.fill(); }
      break;
    case 'bullseye':
      for (let r = .06; r < .48; r += .07) { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); } break;
    case 'arch':
      ctx.beginPath(); ctx.arc(0, .5, .5, Math.PI, 0); ctx.fill(); ctx.strokeStyle = bg;
      for (let r = .08; r < .5; r += .08) { ctx.beginPath(); ctx.arc(0, .5, r, Math.PI, 0); ctx.stroke(); }
      break;
    // Data tiles: thin lines in the ink color, one accent color for the data.
    case 'griddot':
      ctx.strokeStyle = ink; ctx.lineWidth = .012; ctx.globalAlpha *= .7; gridLines(ctx, 6); ctx.globalAlpha /= .7;
      circle(ctx, -.5 + d[0] / 6, -.5 + d[1] / 6, .05, accent);
      break;
    case 'scatter':
      ctx.strokeStyle = ink; ctx.lineWidth = .012; ctx.globalAlpha *= .7; gridLines(ctx, 6); ctx.globalAlpha /= .7;
      for (let i = 0; i < 5; i++) circle(ctx, -.5 + (i + 1) / 6, .5 - (i + 1) / 6 + (d[3 + i] - .5) * .14, .038, accent);
      break;
    case 'pixels':
      ctx.fillStyle = ink;
      for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++)
        if (Math.abs(i) + Math.abs(j) <= 4 && tl.bits[(i + 4) * 9 + j + 4]) ctx.fillRect(i * .085 - .03, j * .085 - .03, .06, .06);
      break;
    case 'tokens':
      for (let i = 0; i < 4; i++) circle(ctx, -.3 + i * .2, 0, .055, ink);
      circle(ctx, -.3 + d[2] * .2, 0, .055, accent);
      break;
    case 'network':
      ctx.strokeStyle = ink; ctx.lineWidth = .014; ctx.beginPath();
      for (const [a, b] of tl.net.edges) { ctx.moveTo(...tl.net.nodes[a]); ctx.lineTo(...tl.net.nodes[b]); }
      ctx.stroke();
      tl.net.nodes.forEach(([x, y], i) => circle(ctx, x, y, i === NET_HUB ? .065 : .045, accent));
      break;
  }
}

// m is the transform of the unit tile in CSS pixels: [a, b, c, d, e, f] as in setTransform.
export function drawTile(ctx, dpr, tl, m, alpha) {
  ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, m[5] * dpr);
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.beginPath(); ctx.rect(-.5, -.5, 1, 1); ctx.clip();
  ctx.fillStyle = tl.bg; ctx.fillRect(-.5, -.5, 1, 1);
  ctx.rotate(tl.rot);
  shape(ctx, tl);
  ctx.restore();
}

// Tiles outside the panel leave when the reading starts: to the left on a desktop, down on a phone.
export function drawLeaving(ctx, dpr, tl, a, grow) {
  const q = leaveProgress(a, tl.outDelay);
  if (grow <= 0 || q >= 1) return;
  const s = tl.size * grow * (1 - .4 * q);
  drawTile(ctx, dpr, tl, [s, 0, 0, s, lerp(tl.hx, tl.out[0], q), lerp(tl.hy, tl.out[1], q)], 1 - q);
}

// Tiles inside the panel build the whole stack at once. p is the progress of that build.
export function drawFlying(ctx, dpr, tl, p, grow) {
  if (grow <= 0) return;
  const q = tileProgress(p, tl.delay);
  const s = tl.size * grow;
  const m = [s, 0, 0, s, tl.hx, tl.hy].map((x, i) => lerp(x, tl.target[i], q));
  m[4] += Math.sin(q * Math.PI) * tl.nx * 40;
  const a = tl.cell ? 1 : 1 - q;
  if (a > .01) drawTile(ctx, dpr, tl, m, a);
}

function poly(ctx, pts, fill) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (const pt of pts.slice(1)) ctx.lineTo(pt[0], pt[1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}

export function drawSides(ctx, dpr, lay, l, alpha) {
  const { R, B, L } = slabPoints(lay, l), d = lay.T;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = alpha;
  poly(ctx, [L, B, [B[0], B[1] + d], [L[0], L[1] + d]], LAYERS[l].dark);
  poly(ctx, [B, R, [R[0], R[1] + d], [B[0], B[1] + d]], LAYERS[l].col);
}

export function drawTint(ctx, dpr, lay, l, alpha) {
  const { T, R, B, L } = slabPoints(lay, l);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = alpha * .3;
  poly(ctx, [T, R, B, L], LAYERS[l].col);
}

// Splits the text into lines no wider than maxW. A single word wider than maxW keeps its own line.
export function wrapText(ctx, text, maxW) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const next = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + word : word;
    if (ctx.measureText(next).width > maxW && lines[lines.length - 1]) lines.push(word); else lines[lines.length - 1] = next;
  }
  return lines;
}

// The label of a layer, right of the stack: a color square, the title and the sentence. Not drawn on a phone.
export function drawLabel(ctx, dpr, lay, l, alpha) {
  if (lay.panel.mobile) return;
  const { R } = slabPoints(lay, l), x = R[0] + LABEL_GAP - 18, y = R[1] + lay.T / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = alpha;
  ctx.fillStyle = LAYERS[l].col; ctx.fillRect(x, y - 16, 10, 10);
  ctx.fillStyle = C.light; ctx.font = TITLE_FONT; ctx.fillText(LAYERS[l].name.toUpperCase(), x + 18, y - 7);
  ctx.fillStyle = MUTED; ctx.font = TEXT_FONT;
  wrapText(ctx, LAYERS[l].sentence, LABEL_W).forEach((line, i) => ctx.fillText(line, x + 18, y + 13 + i * 19));
}
