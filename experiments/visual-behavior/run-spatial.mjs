import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { spatialToJSON, SPATIAL_POPULATIONS } from '../../shared/vision/readouts/spatial.js';
import { coordinatePermutation } from '../../shared/vision/retina.js';
import { loadPackagedFlyvis, hash } from './load-model.mjs';
import { spatialTrialPlan } from './spatial-stimuli.mjs';
import { trialInputs } from './spatial-stimuli.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const destination = path.resolve(process.argv[2] ?? path.join(here, 'reports/spatial-v1'));
if (fs.existsSync(path.join(destination, 'summary.json'))) throw Error('Refusing to overwrite an existing study; choose a new output directory');
fs.mkdirSync(destination, { recursive: true });
const startedAt = new Date().toISOString(), started = performance.now();
const setup = await loadPackagedFlyvis(), { model, readout, manifest } = setup;
const permutation = coordinatePermutation(manifest.inputCoordinates), plan = spatialTrialPlan();
const sourceFiles = ['run-spatial.mjs', 'spatial-stimuli.mjs', 'load-model.mjs', 'SPATIAL-PROTOCOL.md'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(here, file)))]));
const coordinates = readout.metadata.populations.T4a.coordinates;
const central = Object.fromEntries(SPATIAL_POPULATIONS.map(type => [type,
  readout.metadata.populations[type].coordinates.flatMap((c, i) => Math.hypot(c.azimuth, c.elevation) <= 20 ? [i] : []),
]));
const baseline = readout.baseline(setup.arrays.steadyState, {
  id: 'packaged-neutral-fade-in', neuralTime: 0, method: 'packaged-one-second-neutral-fade-in', conditioningSeconds: 1,
});
const records = [], inputChunks = [], snapshotChunks = [], stepCosts = [], intervalCosts = [], extractionCosts = [], resetCosts = [];
let inputOffset = 0, snapshotOffset = 0, allFinite = true, extractionExact = true;
const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(q * values.length))];
const stats = values => ({ count: values.length, median: percentile(values, .5), p95: percentile(values, .95), max: Math.max(...values) });
const sum = values => values.reduce((a, b) => a + b, 0);
const angularError = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

function features(spatial) {
  return SPATIAL_POPULATIONS.map(type => {
    const delta = spatial.populations[type].delta;
    return sum(central[type].map(i => Math.max(0, delta[i]))) / central[type].length;
  });
}

function location(spatial) {
  let weight = 0, x = 0, y = 0;
  for (const type of SPATIAL_POPULATIONS) spatial.populations[type].delta.forEach((value, i) => {
    const w = Math.abs(value), c = readout.metadata.populations[type].coordinates[i];
    weight += w; x += w * c.azimuth; y += w * c.elevation;
  });
  return { weight, x, y };
}

function directionDecoder(calibration) {
  const vectors = SPATIAL_POPULATIONS.map((_, i) => {
    const total = sum(calibration.map(trial => trial.features[i]));
    return {
      x: sum(calibration.map(trial => trial.features[i] * Math.cos(trial.spec.direction * Math.PI / 180))) / Math.max(total, 1e-12),
      y: sum(calibration.map(trial => trial.features[i] * Math.sin(trial.spec.direction * Math.PI / 180))) / Math.max(total, 1e-12),
    };
  });
  const predict = trial => {
    const x = sum(trial.features.map((value, i) => value * vectors[i].x));
    const y = sum(trial.features.map((value, i) => value * vectors[i].y));
    return { direction: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, magnitude: Math.hypot(x, y) };
  };
  const threshold = percentile(calibration.map(trial => predict(trial).magnitude), .25);
  return { vectors, threshold, predict };
}

try {
  for (const spec of plan) {
    const resetStart = performance.now(), eye = model.eye(); resetCosts.push(performance.now() - resetStart);
    const inputs = trialInputs(spec), frames = [], featureTotal = new Array(8).fill(0), locations = [];
    const trial = { spec, inputFloatOffset: inputOffset, inputFrames: inputs.length, frames, snapshots: [] };
    try {
      for (const packet of inputs) {
        const input = Float32Array.from(permutation, index => packet.retina[index]);
        inputChunks.push(Buffer.from(input.buffer)); inputOffset += input.length;
        const intervalStart = performance.now(); let activity;
        for (let tick = 0; tick < 10; tick++) {
          const tickStart = performance.now(); activity = eye.step(input); stepCosts.push(performance.now() - tickStart);
        }
        intervalCosts.push(performance.now() - intervalStart);
        const copiedState = activity.slice(), extractionStart = performance.now();
        const spatial = readout.extract(copiedState, baseline, {
          duckId: 'offline-duck', eyeId: 'right', sourceId: spec.id, frameId: packet.frameId,
          captureTime: packet.captureTime, neuralStartTime: packet.captureTime,
          neuralEndTime: packet.captureTime + spec.captureDt, clock: 'simulation',
        });
        extractionCosts.push(performance.now() - extractionStart);
        const feature = features(spatial), where = location(spatial);
        feature.forEach((value, i) => { featureTotal[i] += value / inputs.length; });
        frames.push({ frameId: packet.frameId, captureTime: packet.captureTime,
          neuralEndTime: spatial.neuralEndTime, features: feature,
          centroid: where.weight ? [where.x / where.weight, where.y / where.weight] : null,
          absoluteDeltaMass: where.weight });
        if (packet.captureTime >= .1 && packet.captureTime < .28) locations.push(where);
        if ([6, 12, inputs.length - 1].includes(packet.frameId)) {
          const snapshot = { frameId: packet.frameId, floatOffset: snapshotOffset };
          for (const type of SPATIAL_POPULATIONS) {
            const population = spatial.populations[type], nodes = readout.metadata.populations[type].nodeIndices;
            for (let i = 0; i < 721; i++) {
              if (population.raw[i] !== copiedState[nodes[i]] || population.delta[i] !== Math.fround(copiedState[nodes[i]] - baseline.populations[type][i])) extractionExact = false;
              if (!Number.isFinite(population.raw[i]) || !Number.isFinite(population.delta[i])) allFinite = false;
            }
            for (const name of ['raw', 'delta']) {
              snapshotChunks.push(Buffer.from(population[name].buffer)); snapshotOffset += 721;
            }
          }
          trial.snapshots.push(snapshot);
        }
      }
      const mass = sum(locations.map(location => location.weight));
      trial.features = featureTotal;
      trial.eventCentroid = mass ? [sum(locations.map(location => location.x)) / mass, sum(locations.map(location => location.y)) / mass] : null;
      records.push(trial);
    } finally { eye.dispose(); }
    if (records.length === 8) {
      fs.writeFileSync(path.join(destination, 'calibration.json'), JSON.stringify({ sourceHashes, model: readout.metadata.model, records }, null, 2));
      console.log('Calibration complete:', records.map(trial => `${trial.spec.polarity}/${trial.spec.direction}:${trial.features.map(x => x.toFixed(4)).join(',')}`).join(' | '));
    }
    if (records.length % 30 === 0) console.log(`Completed ${records.length}/${plan.length} trials (${((performance.now() - started) / 1000).toFixed(1)} s)`);
  }
} finally { model.dispose(); }

function proportion(values) {
  const n = values.length, count = values.filter(Boolean).length, p = count / n, z = 1.959963984540054;
  const center = (p + z * z / (2 * n)) / (1 + z * z / n);
  const radius = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n);
  return { count, n, rate: p, wilson95: [Math.max(0, center - radius), Math.min(1, center + radius)] };
}
const calibration = records.filter(trial => trial.spec.split === 'calibration');
const decoder = directionDecoder(calibration);
for (const trial of records) trial.directionDiagnostic = decoder.predict(trial);
const heldout = records.filter(trial => trial.spec.split === 'heldout');
const directional = [-1, 1].map(polarity => {
  const trials = heldout.filter(trial => trial.spec.family === 'edge' && trial.spec.polarity === polarity);
  const errors = trials.map(trial => angularError(trial.directionDiagnostic.direction, trial.spec.direction));
  const hemisphere = proportion(errors.map(error => error < 90)), medianError = percentile(errors, .5);
  return { polarity, hemisphere, medianErrorDegrees: medianError, meanErrorDegrees: sum(errors) / errors.length,
    passed: hemisphere.rate >= .75 && medianError <= 60 };
});
const spatialLocation = [-1, 1].map(polarity => {
  const trials = heldout.filter(trial => trial.spec.family === 'local-flash' && trial.spec.polarity === polarity);
  const correct = proportion(trials.map(trial => trial.eventCentroid && trial.eventCentroid[0] * trial.spec.side > 0));
  return { polarity, correctHemisphere: correct, passed: correct.rate >= .9 };
});
const confounds = ['blank', 'flash', 'flicker'].map(family => {
  const trials = heldout.filter(trial => trial.spec.family === family);
  const falseMotion = proportion(trials.map(trial => trial.directionDiagnostic.magnitude >= decoder.threshold));
  return { family, falseMotion, passed: falseMotion.rate <= .1 };
});
const timing = { stepMs: stats(stepCosts), intervalMs: stats(intervalCosts), extractionMs: stats(extractionCosts), resetMs: stats(resetCosts) };
const extractionGate = extractionExact && allFinite;
const directionGate = directional.every(result => result.passed), confoundGate = confounds.every(result => result.passed);
const summary = {
  format: 'duckfly-spatial-readout-study', version: 1, startedAt, finishedAt: new Date().toISOString(),
  elapsedSeconds: (performance.now() - started) / 1000, sourceHashes, modelHashes: setup.hashes,
  runtime: { node: process.version, platform: process.platform, arch: process.arch, cpus: os.cpus()[0]?.model, concurrency: 1 },
  counts: { trials: records.length, calibration: calibration.length, heldout: heldout.length, seeds: 30, integrationSteps: stepCosts.length },
  gates: { extraction: extractionGate, spatialLocation: spatialLocation.every(result => result.passed),
    direction: directionGate, directionConfounds: confoundGate, singleEyeRealTime: timing.intervalMs.p95 <= 20,
    neuralBridgePromoted: false, bodyControlPromoted: false },
  direction: directional, spatialLocation, confounds, timing,
  decoder: { method: 'calibration-response-weighted population vectors; positive delta within central 20-degree disk',
    populationOrder: SPATIAL_POPULATIONS, vectors: decoder.vectors, strongDirectionThreshold: decoder.threshold,
    physiologicalClaim: false, reliableDirectionCandidate: directionGate && confoundGate },
  interpretation: 'Extraction and event-location evidence only. A direction pass without confound rejection does not authorize motion control. No higher visual module, anatomical bridge, body test or physiological validation is included.',
};
const inputBinary = gzipSync(Buffer.concat(inputChunks)), snapshotBinary = gzipSync(Buffer.concat(snapshotChunks));
fs.writeFileSync(path.join(destination, 'inputs.f32.gz'), inputBinary);
fs.writeFileSync(path.join(destination, 'snapshots.f32.gz'), snapshotBinary);
fs.writeFileSync(path.join(destination, 'metadata.json'), JSON.stringify({
  spatialMetadata: readout.metadata, baseline: spatialToJSON(baseline),
  binaryFormat: { endianness: 'little', dtype: 'Float32', inputOrder: 'trial, frame, model inputCoordinates',
    snapshotOrder: 'trial snapshots, populationOrder, raw[721], delta[721]', populationOrder: SPATIAL_POPULATIONS },
}, null, 2));
fs.writeFileSync(path.join(destination, 'trials.json.gz'), gzipSync(JSON.stringify(records)));
summary.evidence = Object.fromEntries(['inputs.f32.gz', 'snapshots.f32.gz', 'metadata.json', 'trials.json.gz', 'calibration.json'].map(file => {
  const bytes = fs.readFileSync(path.join(destination, file)); return [file, { sha256: hash(bytes), bytes: bytes.length }];
}));
fs.writeFileSync(path.join(destination, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!extractionGate) process.exitCode = 1;
