import {WIDTH, HEIGHT} from './detectors.mjs';

export const FAMILIES = Object.freeze([
  'small-pass', 'small-step', 'large-bar', 'stationary-flicker', 'global-flash',
  'approach-dark', 'approach-bright', 'dimming', 'translation', 'recession',
  'background-rotation', 'textured-small-pass', 'textured-approach', 'translation-dimming',
]);
const OBJECT_EVENTS = new Set(['small-pass', 'small-step', 'textured-small-pass']);
const EXPANSIONS = new Set(['approach-dark', 'approach-bright', 'textured-approach']);
function random(seed) {
  let n = 2166136261;
  for (const ch of seed) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return () => {n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296;};
}
export function cases(split, count) {
  if (!['calibration', 'heldout'].includes(split)) throw Error('Unknown movie split');
  return FAMILIES.flatMap(family => Array.from({length: count}, (_, index) => {
    const id = `candidates-${split}-${family}-${index}`, r = random(id), heldout = split === 'heldout';
    return {id, split, family, index, dt: heldout ? [.025, .04, .05][index % 3] : .04,
      duration: 1.2, onset: .24, cx: 38 + r() * 20, cy: 23 + r() * 18,
      radius: heldout ? 2.2 + r() * 3.3 : 3 + r() * 2,
      speed: heldout ? 8 + r() * 18 : 12 + r() * 9,
      radialSpeed: heldout ? 4 + r() * 10 : 6 + r() * 5,
      background: .4 + r() * .35, contrast: heldout ? .2 + r() * .55 : .35 + r() * .3,
      direction: r() > .5 ? 1 : -1, angle: (r() - .5) * (heldout ? 1.4 : .8),
      phase: r() * Math.PI * 2, noise: heldout ? .012 * r() : 0,
      objectEvent: OBJECT_EVENTS.has(family), expansion: EXPANSIONS.has(family),
      scope: family.startsWith('textured-') || family === 'background-rotation' ? 'background-stress' : 'uniform-border'};
  }));
}

// Anti-aliased synthetic movies use retinal pixel coordinates. Labels and geometry
// live in the study only; the detectors receive RGBA frames and capture time.
export function movieFrame(c, time) {
  const gray = new Uint8Array(WIDTH * HEIGHT), pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  const phase = Math.max(0, time - c.onset), active = time >= c.onset;
  let cx = c.cx, cy = c.cy, radius = c.radius, contrast = c.contrast;
  if (['small-pass', 'large-bar', 'translation', 'textured-small-pass', 'translation-dimming'].includes(c.family)) {
    cx += c.direction * Math.cos(c.angle) * c.speed * phase;
    cy += Math.sin(c.angle) * c.speed * phase;
  }
  if (c.family === 'small-step' && active) {cx += c.direction * 3.5; cy += Math.sin(c.angle) * 2;}
  if (c.expansion) radius += c.radialSpeed * phase;
  if (c.family === 'recession') radius = Math.max(1.8, 15 - c.radialSpeed * phase);
  if (['translation', 'dimming', 'translation-dimming'].includes(c.family)) radius = 10;
  if (['dimming', 'translation-dimming'].includes(c.family)) contrast *= .22 + Math.min(.78, phase * 1.4);
  if (c.family === 'stationary-flicker') contrast *= .55 + .45 * Math.sin(time * Math.PI * 12 + c.phase);
  const textured = c.scope === 'background-stress';
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const offset = c.family === 'background-rotation' ? c.speed * phase : 0;
    let value = c.background + (textured ? .12 * Math.sin((x - offset) * .4 + .08 * y + c.phase) : 0);
    if (c.family === 'global-flash') value += active ? .15 * Math.sin(phase * 15 + .8) : 0;
    else if (c.family !== 'background-rotation') {
      const dx = x - cx, dy = y - cy;
      const signedDistance = c.family === 'large-bar' ? Math.max(Math.abs(dx) - 4.5, Math.abs(dy) - 19) : Math.hypot(dx, dy) - radius;
      const coverage = Math.max(0, Math.min(1, .5 - signedDistance));
      value += (c.family === 'approach-bright' ? 1 : -1) * contrast * coverage;
    }
    // Deterministic weak sensor-like pattern, independent of the class label.
    value += c.noise * Math.sin(x * 12.99 + y * 7.23 + time * 33.17 + c.phase);
    const i = y * WIDTH + x, v = Math.round(Math.max(0, Math.min(1, value)) * 255);
    gray[i] = v; pixels.set([v, v, v, 255], i * 4);
  }
  return {gray, pixels};
}
export function frameTimes(c) {return Array.from({length: Math.round(c.duration / c.dt) + 1}, (_, i) => Number((i * c.dt).toFixed(8)));}
export function grayToRgba(gray) {
  if (!(gray instanceof Uint8Array) || gray.length !== WIDTH * HEIGHT) throw Error('Invalid gray8 frame');
  const pixels = new Uint8Array(gray.length * 4);
  for (let i = 0; i < gray.length; i++) pixels.set([gray[i], gray[i], gray[i], 255], i * 4);
  return pixels;
}
