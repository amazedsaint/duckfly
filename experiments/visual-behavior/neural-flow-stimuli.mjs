import { WIDTH, HEIGHT, EYE_CALIBRATION } from '../../shared/vision/frame.js';
import { sampleRetina } from '../../shared/vision/retina.js';

const rad = Math.PI / 180;
const random = seed => { let state = seed >>> 0; return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296); };
export const FLOW_DT = .02;
export const FLOW_DURATION = .6;

export function neuralFlowPlan() {
  const trials = [];
  for (const direction of [0, 90, 180, 270]) for (const wavelength of [10, 18]) for (const speed of [60, 120]) {
    trials.push({ split: 'calibration', family: 'grating', direction, wavelength, speed, contrast: .65, phase: 0, polarity: 1,
      id: `cal-${direction}-${wavelength}-${speed}`, seed: 2000 + trials.length });
  }
  for (let seed = 4000; seed < 4030; seed++) {
    const rng = random(seed), parameters = { seed, split: 'heldout', direction: 22.5 + seed % 8 * 45,
      wavelength: 11 + 8 * rng(), speed: 72 + 36 * rng(), contrast: .4 + .4 * rng(), phase: 2 * Math.PI * rng(),
      polarity: seed % 2 ? -1 : 1 };
    for (const family of ['grating', 'edge-on', 'edge-off', 'blank', 'flash', 'flicker', 'static-grating', 'counterphase', 'illumination']) {
      trials.push({ ...parameters, family, id: `${family}-${seed}` });
    }
  }
  return trials.map(trial => ({ ...trial, captureDt: FLOW_DT, duration: FLOW_DURATION }));
}

export function neuralFlowPixels(trial, time) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4), angle = trial.direction * rad;
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const az = Math.atan((2 * x / (WIDTH - 1) - 1) * Math.tan(EYE_CALIBRATION.verticalFov * rad / 2) * EYE_CALIBRATION.aspect) / rad;
    const el = Math.atan((1 - 2 * y / (HEIGHT - 1)) * Math.tan(EYE_CALIBRATION.verticalFov * rad / 2)) / rad;
    const projection = az * Math.cos(angle) + el * Math.sin(angle);
    let value = .5;
    if (trial.family === 'grating') value += trial.contrast * .5 * Math.sin(2 * Math.PI * (projection - trial.speed * time) / trial.wavelength + trial.phase);
    if (['static-grating', 'counterphase', 'illumination'].includes(trial.family)) {
      const modulation = trial.family === 'counterphase' ? Math.cos(2 * Math.PI * (3 + trial.seed % 4) * time) : 1;
      value += trial.contrast * .5 * modulation * Math.sin(2 * Math.PI * projection / trial.wavelength + trial.phase);
      if (trial.family === 'illumination') value += .12 * Math.sin(2 * Math.PI * 2 * time);
    }
    if (trial.family.startsWith('edge-')) {
      const polarity = trial.family === 'edge-on' ? 1 : -1;
      value += polarity * trial.contrast * .25 * (1 + Math.tanh((-26 + trial.speed * time - projection) / .8));
    }
    if (trial.family === 'flash' && time >= .12) value += trial.polarity * trial.contrast * .5;
    if (trial.family === 'flicker') value += trial.polarity * trial.contrast * .5 * Math.sin(2 * Math.PI * (3 + trial.seed % 4) * time);
    const gray = Math.max(0, Math.min(255, Math.round(value * 255))), index = (y * WIDTH + x) * 4;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = gray; pixels[index + 3] = 255;
  }
  return pixels;
}

export function neuralFlowInputs(trial) {
  return Array.from({ length: Math.round(trial.duration / trial.captureDt) }, (_, frameId) => ({
    frameId, captureTime: frameId * trial.captureDt,
    retina: sampleRetina(neuralFlowPixels(trial, frameId * trial.captureDt), EYE_CALIBRATION),
  }));
}
