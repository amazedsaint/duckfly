import { WIDTH, HEIGHT, EYE_CALIBRATION } from '../../shared/vision/frame.js';
import { sampleRetina } from '../../shared/vision/retina.js';

export const CAPTURE_DT = .02;
export const DURATION = .48;
const radians = Math.PI / 180;
const smooth = x => .5 + .5 * Math.tanh(x);
const noise = seed => {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
};

export function trialSpec(family, seed, polarity = 1, options = {}) {
  const random = noise(seed), heldout = options.split !== 'calibration';
  return {
    id: `${options.split ?? 'heldout'}-${family}-${seed}-${polarity}-${options.reverse ? 'reverse' : options.side ?? 'forward'}`,
    split: options.split ?? 'heldout', family, seed, polarity,
    direction: ((heldout ? 22.5 + seed % 8 * 45 : seed * 90) + (options.reverse ? 180 : 0)) % 360,
    contrast: heldout ? .42 + .43 * random() : .65,
    speed: heldout ? 100 + 45 * random() : 125,
    edgeSoftness: heldout ? .55 + .8 * random() : .8,
    centerElevation: heldout ? -3 + 6 * random() : 0,
    side: options.side ?? 1,
    captureDt: CAPTURE_DT, duration: DURATION,
    calibration: { ...EYE_CALIBRATION, eyeYaw: 0 },
  };
}

/** Synthetic grayscale camera movies. Directions are in eye image degrees, not neuron labels. */
export function trialPixels(spec, time) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4), angle = spec.direction * radians;
  const active = time >= .06, phase = Math.max(0, time - .06);
  const phaseEdge = -30 + spec.speed * phase;
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const azimuth = Math.atan((2 * x / (WIDTH - 1) - 1) * Math.tan(spec.calibration.verticalFov * radians / 2) * spec.calibration.aspect) / radians;
    const elevation = Math.atan((1 - 2 * y / (HEIGHT - 1)) * Math.tan(spec.calibration.verticalFov * radians / 2)) / radians;
    const projection = azimuth * Math.cos(angle) + elevation * Math.sin(angle);
    let signal = 0;
    if (spec.family === 'edge' && active) signal = smooth((phaseEdge - projection) / spec.edgeSoftness);
    if (spec.family === 'flash' && time >= .12) signal = 1;
    if (spec.family === 'flicker' && active) signal = Math.sin(2 * Math.PI * (4 + spec.seed % 4) * phase);
    if (spec.family === 'local-flash' && time >= .1 && time < .28) {
      signal = Math.exp(-((azimuth - spec.side * 13) ** 2 + (elevation - spec.centerElevation) ** 2) / (2 * 3.5 ** 2));
    }
    const gray = Math.max(0, Math.min(255, Math.round(255 * (.5 + spec.polarity * spec.contrast * .5 * signal))));
    const index = (y * WIDTH + x) * 4;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = gray;
    pixels[index + 3] = 255;
  }
  return pixels;
}

export function trialInputs(spec) {
  return Array.from({ length: Math.round(spec.duration / spec.captureDt) }, (_, frameId) => {
    const captureTime = frameId * spec.captureDt, pixels = trialPixels(spec, captureTime);
    return { frameId, captureTime, retina: sampleRetina(pixels, spec.calibration) };
  });
}

export function spatialTrialPlan() {
  const trials = [];
  for (let direction = 0; direction < 4; direction++) for (const polarity of [-1, 1]) {
    trials.push(trialSpec('edge', direction, polarity, { split: 'calibration' }));
  }
  for (let seed = 1000; seed < 1030; seed++) {
    for (const polarity of [-1, 1]) {
      trials.push(trialSpec('edge', seed, polarity));
      trials.push(trialSpec('edge', seed, polarity, { reverse: true }));
      for (const side of [-1, 1]) trials.push(trialSpec('local-flash', seed, polarity, { side }));
    }
    for (const family of ['blank', 'flash', 'flicker']) trials.push(trialSpec(family, seed, seed % 2 ? -1 : 1));
  }
  return trials;
}
