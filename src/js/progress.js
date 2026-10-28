import { clamp, ease } from './math.js';

// Maps the scroll position to animation phases. Pure functions: no window or document.
// Ported from frame() in prototypes/split-layout.html.

// a: the wall moves into the panel while the hero scrolls away.
// b: progress from About to the end of Posts (or Community when Posts is absent).
// build: the whole stack builds in the first quarter of b.
// labels: each label appears in its own quarter of b, in order.
export function scrollPhases({ sy, H, heroH, startTop, endTop, endHeight }) {
  const a = clamp(sy / (heroH * .8));
  const bStart = startTop - .4 * H;
  const bEnd = endTop + endHeight - .8 * H;
  const b = clamp((sy - bStart) / (bEnd - bStart));
  const build = clamp(b / .25);
  const labels = [0, 1, 2].map(l => ease(clamp((b - .25 - l * .25) / .12)));
  return { a, b, build, labels };
}

export const tileProgress = (p, delay) => ease(clamp((p - .05 - delay) / .45));

export const leaveProgress = (a, outDelay) => ease(clamp((a - outDelay) / .6));

export const slabAlpha = build => ease(clamp((build - .55) / .25));

export function reducedPhases({ sy, H, startTop }) {
  return { stack: sy >= startTop - .4 * H };
}

// How far the wall has scrolled up with the page: 0 until the top of Contact enters the screen,
// then as far as the page has scrolled since.
export const releaseOffset = (sy, contactTop, H) => Math.max(0, sy - (contactTop - H));
