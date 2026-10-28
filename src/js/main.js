// The canvas scene (wall, panel, stack and labels) and the wiring to the page.
// Ported from frame() and build() in prototypes/split-layout.html.
import { C } from './palette.js';
import { clamp, ease, lerp } from './math.js';
import { buildWall, idleStep } from './wall.js';
import { panelFor, splitTiles, stackLayout, assignStack } from './layout.js';
import { scrollPhases, slabAlpha, reducedPhases, releaseOffset } from './progress.js';
import { growth, drawTile, drawLeaving, drawFlying, drawSides, drawTint, drawLabel, drawLiftedTile } from './draw.js';
import { ripplePause, rippleMs, startRipple, rippleStep, rippleParts } from './ripple.js';
import { showNextEvent } from './next-event.js';

const FADE_MS = 300;

// scrollPhases divides by the hero height and by the length of the reading range.
// On the page both are positive. For other values, the phase counts as finished, so no NaN reaches the canvas.
function phasesFor(s) {
  const p = scrollPhases(s);
  const range = (s.endTop + s.endHeight - .8 * s.H) - (s.startTop - .4 * s.H);
  if (!(s.heroH > 0)) p.a = 1;
  if (!(range > 0)) return { ...p, b: 1, build: 1, labels: [1, 1, 1] };
  return p;
}

// canvas needs only clientWidth, clientHeight, width, height and getContext('2d').
// rand is for tests; the page uses Math.random. The scene does not read window or document.
export function createScene(canvas, { reducedMotion = false, dpr = 1, rand = Math.random } = {}) {
  const ctx = canvas.getContext('2d');
  const idle = { lastFlip: 0, lastData: 0 };
  let W, H, panel, lay, tiles = [], leaving = [], extras = [], layers = [[], [], []];
  // A row of tiles flipping over in one layer (see ripple.js), and the pause before the next one.
  // firstPause is drawn once per scene, so it does not change while the visitor scrolls around.
  let ripple = null, lastRipple = 0;
  const firstPause = ripplePause(rand, true);
  let pause = firstPause;
  let start = null; // time of the first frame, for the opening
  let fade = null;  // reduced motion: the fade between the wall (0) and the stack (1)

  // An optional new dpr, for example after the browser zoom changed.
  function rebuild(opts = {}) {
    if (opts.dpr) dpr = opts.dpr;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    tiles = buildWall(W, H, rand).tiles;
    panel = panelFor(W, H);
    const split = splitTiles(tiles, panel, W, H, rand);
    leaving = split.leaving;
    lay = stackLayout(panel, split.kept.length, H);
    ({ layers, extras } = assignStack(split.kept, lay, rand));
    ripple = null;
  }

  // A phone has an empty panel, so it never draws a stack (see panelFor).
  const hasStack = () => panel.h > 0;

  function renderMoving(now, { a, build, labels }) {
    const t = (now - start) / 1000;
    const ea = ease(a);
    ctx.fillStyle = C.navy;
    ctx.fillRect(lerp(0, panel.x, ea), lerp(0, panel.y, ea), lerp(W, panel.w, ea), lerp(H, panel.h, ea));

    idleStep(tiles, now, idle, rand);

    for (const tl of leaving) drawLeaving(ctx, dpr, tl, a, growth(t, tl.at));
    if (!hasStack()) return;
    const slabQ = slabAlpha(build);
    // Ripples run only while the stack is complete. Scrolling back ends a running ripple at once.
    const ready = build >= 1 && slabQ >= 1;
    if (ripple && (!ready || now - ripple.at >= rippleMs(ripple))) { ripple = null; lastRipple = now; pause = ripplePause(rand); }
    if (!ready) { lastRipple = now; pause = firstPause; }
    else if (!ripple && now - lastRipple >= pause) ripple = startRipple(layers, [...extras, ...leaving], lay.n, now, rand);
    if (ripple) rippleStep(ripple, now);
    // Tiles in the air are drawn after the flat ones, from the back to the front.
    const parts = ripple ? rippleParts(ripple, now).sort((a, b) => (a.tile.cell.u + a.tile.cell.v) - (b.tile.cell.u + b.tile.cell.v)) : [];
    const inAir = new Set(parts.map(pt => pt.tile));

    for (const tl of extras) drawFlying(ctx, dpr, tl, build, growth(t, tl.at));
    for (let l = 0; l < 3; l++) {
      if (slabQ > 0) drawSides(ctx, dpr, lay, l, slabQ);
      for (const tl of layers[l]) if (!inAir.has(tl)) drawFlying(ctx, dpr, tl, build, growth(t, tl.at));
      if (slabQ > 0) drawTint(ctx, dpr, lay, l, slabQ);
      if (ripple && ripple.l === l) for (const pt of parts) drawLiftedTile(ctx, dpr, pt.tile, pt.m, l);
    }
    if (lay.labels) for (let l = 0; l < 3; l++) if (labels[l] > 0) drawLabel(ctx, dpr, lay, l, labels[l]);
  }

  // Reduced motion: a still wall, then a short fade to the finished stack with all labels. Nothing flies.
  function renderStill(now, scroll) {
    const to = reducedPhases(scroll).stack ? 1 : 0;
    const value = () => lerp(fade.from, fade.to, clamp((now - fade.at) / FADE_MS));
    if (!fade) fade = { from: to, to, at: now };
    else if (fade.to !== to) fade = { from: value(), to, at: now };
    const f = value();

    ctx.fillStyle = C.navy;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    if (f < 1) {
      ctx.globalAlpha = 1 - f;
      ctx.fillRect(0, 0, W, H);
      for (const tl of tiles) drawTile(ctx, dpr, tl, [tl.size, 0, 0, tl.size, tl.hx, tl.hy], 1 - f);
    }
    if (f > 0 && hasStack()) {
      for (let l = 0; l < 3; l++) {
        drawSides(ctx, dpr, lay, l, f);
        for (const tl of layers[l]) drawTile(ctx, dpr, tl, tl.target, f);
        drawTint(ctx, dpr, lay, l, f);
      }
      if (lay.labels) for (let l = 0; l < 3; l++) drawLabel(ctx, dpr, lay, l, f);
    }
  }

  function render(now, scroll) {
    const phases = phasesFor(scroll);
    // A page opened already scrolled (a link to a section, or a restored position) skips the opening.
    if (start === null) start = phases.a > 0 ? -Infinity : now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (reducedMotion) renderStill(now, scroll); else renderMoving(now, phases);
  }

  const debug = () => ({ leaving, extras, layers });

  rebuild();
  return { rebuild, render, debug };
}

// Today in the local time zone, as YYYY-MM-DD.
function localIsoDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function wirePage() {
  const canvas = document.getElementById('c');
  const hero = document.getElementById('top');
  const about = document.getElementById('about');
  const end = document.getElementById('posts') || document.getElementById('community');
  const hint = document.getElementById('hint');
  const contact = document.getElementById('contact');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
  // Position on the page. offsetTop would be relative to <main>, which is positioned.
  const pageTop = el => el.getBoundingClientRect().top + window.scrollY;

  showNextEvent(document, localIsoDate(new Date()));

  // The canvas size and pixel ratio of the last build. A phone fires resize when its toolbar shows or hides,
  // but the canvas (100vh) keeps its size. Then the wall is kept as it is and not drawn again at random.
  const sizeNow = () => `${canvas.clientWidth}x${canvas.clientHeight}@${window.devicePixelRatio}`;
  let builtSize;
  const makeScene = () => {
    builtSize = sizeNow();
    return createScene(canvas, { reducedMotion: motion.matches, dpr: pixelRatio() });
  };
  let scene = makeScene();
  motion.addEventListener('change', () => { scene = makeScene(); });

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (sizeNow() === builtSize) return;
      builtSize = sizeNow();
      scene.rebuild({ dpr: pixelRatio() });
    }, 150);
  });

  let first = null, lastLift = 0;
  function loop(now) {
    if (first === null) first = now;
    const sy = window.scrollY;
    scene.render(now, {
      sy, H: canvas.clientHeight, heroH: hero.offsetHeight,
      startTop: pageTop(about), endTop: pageTop(end), endHeight: end.offsetHeight,
    });
    // The hint appears after the opening (at once with reduced motion) and goes away on the first scroll.
    const shown = motion.matches ? 1 : clamp(((now - first) / 1000 - 2) / .6);
    if (hint) hint.style.opacity = shown * (1 - clamp(sy / 80));
    // Before Contact, the stack lets go and scrolls up with the page, so Contact has the screen to itself.
    const lift = contact ? releaseOffset(sy, pageTop(contact), canvas.clientHeight) : 0;
    if (lift !== lastLift) { canvas.style.transform = lift ? `translateY(${-lift}px)` : ''; lastLift = lift; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Importing this module in Node (for the tests) does nothing.
if (typeof document !== 'undefined') wirePage();
