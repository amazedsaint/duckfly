import { neuralFlowPlan as originalPlan, neuralFlowInputs, neuralFlowPixels, FLOW_DT, FLOW_DURATION } from './neural-flow-stimuli.mjs';

export { neuralFlowInputs, neuralFlowPixels, FLOW_DT, FLOW_DURATION };

export function neuralFlowPlan() {
  const calibration = originalPlan().filter(trial => trial.split === 'calibration');
  const trials = [...calibration], size = 30;
  // Explicit strata cover each declared interval. Coprime permutations separate
  // each parameter's order while keeping matched conditions deterministic.
  const stratum = (index, step) => ((index * step) % size + .5) / size;
  for (let index = 0; index < size; index++) {
    const seed = 8000 + index;
    const parameters = { seed, split: 'heldout', direction: 33.75 + index % 8 * 45,
      wavelength: 11 + 8 * stratum(index, 7), speed: 72 + 36 * stratum(index, 11),
      contrast: .4 + .4 * stratum(index, 13), phase: 2 * Math.PI * stratum(index, 17),
      polarity: index % 2 ? -1 : 1, captureDt: FLOW_DT, duration: FLOW_DURATION };
    for (const family of ['grating', 'edge-on', 'edge-off', 'blank', 'flash', 'flicker', 'static-grating', 'counterphase', 'illumination']) {
      trials.push({ ...parameters, family, id: `stratified-${family}-${seed}` });
    }
  }
  return trials;
}
