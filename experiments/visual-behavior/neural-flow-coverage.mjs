const EXPECTED_RANGES = Object.freeze({ wavelength: [11, 19], speed: [72, 108], contrast: [.4, .8], phase: [0, 2 * Math.PI] });

/** Admission for this bounded study's declared held-out parameter coverage. */
export function neuralFlowCoverage(plan) {
  const heldout = plan.filter(trial => trial.split === 'heldout');
  const parameters = {};
  for (const [key, [low, high]] of Object.entries(EXPECTED_RANGES)) {
    const values = heldout.map(trial => trial[key]);
    const finite = values.length > 0 && values.every(value => typeof value === 'number' && Number.isFinite(value));
    const min = finite ? Math.min(...values) : null, max = finite ? Math.max(...values) : null;
    const bins = finite ? [...new Set(values.map(value => Math.min(7, Math.max(0, Math.floor(8 * (value - low) / (high - low))))))].sort() : [];
    const fractionOfDeclaredSpan = finite ? (max - min) / (high - low) : 0;
    parameters[key] = { declaredInterval: [low, high], actualInterval: [min, max], occupiedBins: bins.length, totalBins: 8,
      fractionOfDeclaredSpan, passed: finite && min >= low && max <= high && bins.length === 8 && fractionOfDeclaredSpan >= .8 };
  }
  const calibrationAngles = new Set(plan.filter(trial => trial.split === 'calibration').map(trial => trial.direction));
  const angles = [...new Set(heldout.map(trial => trial.direction))].sort((a, b) => a - b);
  const directionBins = new Set(angles.map(angle => Math.floor((angle % 360) / 45)));
  const disjointAngles = angles.every(angle => !calibrationAngles.has(angle));
  const uniqueSeeds = new Set(heldout.map(trial => trial.seed)).size;
  const familyCounts = Object.fromEntries([...new Set(heldout.map(trial => trial.family))].map(family => [family, heldout.filter(trial => trial.family === family).length]));
  const familiesComplete = ['grating', 'edge-on', 'edge-off', 'blank', 'flash', 'flicker', 'static-grating', 'counterphase', 'illumination']
    .every(family => familyCounts[family] >= 30);
  return {
    format: 'duckfly-neural-flow-coverage', version: 1, parameters, angles, disjointCalibrationAngles: disjointAngles,
    uniqueSeeds, familyCounts, passed: Object.values(parameters).every(parameter => parameter.passed) &&
      directionBins.size === 8 && disjointAngles && uniqueSeeds >= 30 && familiesComplete,
    interpretation: 'Generator coverage admission only; neither physiology nor control validation. Actual ranges are reported instead of inferring breadth from PRNG formulas.',
  };
}

export function assertNeuralFlowCoverage(plan) {
  const report = neuralFlowCoverage(plan);
  if (!report.passed) throw Error(`Neural-flow generator failed declared coverage: ${JSON.stringify(report)}`);
  return report;
}
