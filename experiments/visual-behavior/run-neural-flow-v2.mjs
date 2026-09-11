import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { coordinatePermutation } from '../../shared/vision/retina.js';
import { SPATIAL_POPULATIONS, spatialToJSON } from '../../shared/vision/readouts/spatial.js';
import { createNeuralMapFlow } from '../../shared/vision/readouts/neural-map-flow-v2.js';
import { loadPackagedFlyvis, hash, readVision } from './load-model.mjs';
import { neuralFlowPlan, neuralFlowInputs } from './neural-flow-v2-stimuli.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const destination = path.resolve(process.argv[2] ?? path.join(here, 'reports/neural-flow-v2'));
if (fs.existsSync(path.join(destination, 'summary.json'))) throw Error('Refusing to replace retained neural-flow results');
fs.mkdirSync(destination, { recursive: true });
const started = performance.now(), startedAt = new Date().toISOString();
const setup = await loadPackagedFlyvis(), { model, readout, arrays, manifest } = setup;
const decoder = createNeuralMapFlow(readout.metadata), permutation = coordinatePermutation(manifest.inputCoordinates);
const sourceFiles = ['run-neural-flow-v2.mjs', 'neural-flow-v2-stimuli.mjs', 'NEURAL-FLOW-V2-PROTOCOL.md', 'load-model.mjs'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(here, file)))]));
sourceHashes.neuralMapFlow = hash(readVision('readouts/neural-map-flow-v2.js'));
const plan = neuralFlowPlan(), records = [], inputChunks = [], conditioned = new Map(), intervalCosts = [], extractionCosts = [], decoderCosts = [], fadeCosts = [], ablations = [];
let inputOffset = 0, minimumGradient = 0;
const quantile = (a, q) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];
const stats = a => ({ count: a.length, median: quantile(a, .5), p95: quantile(a, .95), max: Math.max(...a) });
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const angleError = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
function ablate(frame, method) {
  const result = { ...frame, populations: {} };
  for (const type of SPATIAL_POPULATIONS) {
    const values = frame.populations[type].raw;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    result.populations[type] = { raw: new Float32Array(721).fill(mean) };
  }
  return result;
}
try {
  for (const spec of plan) {
    const packets = neuralFlowInputs(spec), inputs = packets.map(packet => Float32Array.from(permutation, index => packet.retina[index]));
    const initialKey = hash(bytes(inputs[0]));
    if (!conditioned.has(initialKey)) {
      const eye = model.eye(arrays.bias), start = performance.now();
      try {
        for (let tick = 0; tick < 500; tick++) eye.step(Float32Array.from(inputs[0], value => .5 + (value - .5) * tick / 499));
        conditioned.set(initialKey, eye.checkpoint());
      } finally { eye.dispose(); }
      fadeCosts.push(performance.now() - start);
    }
    const initial = conditioned.get(initialKey), eye = model.eye(initial);
    const baseline = readout.baseline(initial, { id: `initial-${initialKey}`, neuralTime: 0, method: 'reference-fade-into-initial-image', conditioningSeconds: 1 });
    const record = { spec, initialInputSha256: initialKey, initialStateSha256: hash(bytes(initial)), inputFloatOffset: inputOffset, frames: [] };
    const neuralHash = createHash('sha256'); let previous;
    try {
      for (let frameId = 0; frameId < packets.length; frameId++) {
        const packet = packets[frameId], input = inputs[frameId];
        inputChunks.push(bytes(input)); inputOffset += 721;
        const stepStart = performance.now(); let activity;
        for (let tick = 0; tick < 10; tick++) activity = eye.step(input);
        intervalCosts.push(performance.now() - stepStart);
        const extractStart = performance.now();
        const response = readout.extract(activity, baseline, {
          duckId: 'neural-flow-duck', eyeId: 'right', sourceId: spec.id, frameId,
          captureTime: packet.captureTime, neuralStartTime: packet.captureTime,
          neuralEndTime: packet.captureTime + spec.captureDt, clock: 'simulation',
        });
        extractionCosts.push(performance.now() - extractStart);
        for (const type of SPATIAL_POPULATIONS) neuralHash.update(bytes(response.populations[type].raw));
        let result = null;
        if (previous) {
          const fitStart = performance.now(); result = decoder.estimate(previous, response, { minimumGradient });
          decoderCosts.push(performance.now() - fitStart);
          if (frameId === 12 && spec.split === 'heldout' && spec.seed === 6000 && ['grating', 'edge-on', 'edge-off'].includes(spec.family)) {
            const spatial = decoder.estimate(ablate(previous), ablate(response), { minimumGradient });
            const temporal = decoder.estimate({ ...previous, populations: response.populations }, response, { minimumGradient });
            ablations.push({ id: spec.id, frameId, original: result, spatialMean: spatial, frozenHistory: temporal,
              passed: !spatial.available && !temporal.available });
          }
        }
        record.frames.push({ frameId, captureTime: packet.captureTime, result }); previous = response;
      }
    } finally { eye.dispose(); }
    record.neuralRawMapsSha256 = neuralHash.digest('hex'); records.push(record);
    if (records.length === 16) {
      const strengths = records.flatMap(record => record.frames.filter(frame => frame.captureTime >= .1 && frame.result).map(frame => frame.result.gradientRms));
      minimumGradient = .25 * quantile(strengths, .1);
      fs.writeFileSync(path.join(destination, 'calibration.json'), JSON.stringify({ sourceHashes, minimumGradient, records }, null, 2));
      console.log(`Calibration frozen: minimumGradient=${minimumGradient}`);
    }
    if (records.length % 20 === 0) console.log(`Completed ${records.length}/${plan.length} trials (${((performance.now() - started) / 1000).toFixed(1)} s)`);
  }
} finally { model.dispose(); }

const heldout = records.filter(record => record.spec.split === 'heldout');
const moving = ['grating', 'edge-on', 'edge-off'], stationary = ['blank', 'flash', 'flicker', 'static-grating', 'counterphase', 'illumination'];
for (const record of heldout) {
  const frames = record.frames.filter(frame => frame.captureTime >= .1 && frame.result);
  const available = frames.filter(frame => frame.result.available);
  const x = quantile(frames.map(frame => frame.result.velocity?.x ?? 0), .5), y = quantile(frames.map(frame => frame.result.velocity?.y ?? 0), .5);
  const speed = Math.hypot(x, y), direction = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  let previousFalse = false, falseTrial = false, falseFrames = 0;
  for (const frame of frames) {
    const falseNow = frame.result.available && frame.result.speed > 3;
    if (falseNow) falseFrames++;
    if (falseNow && previousFalse) falseTrial = true;
    previousFalse = falseNow;
  }
  record.assessment = { availability: available.length / frames.length, speed, direction,
    directionErrorDegrees: angleError(direction, record.spec.direction),
    relativeSpeedError: Math.abs(speed - record.spec.speed) / record.spec.speed,
    falseTrial, falseFrames, analyzedFrames: frames.length };
}
const movingResults = moving.map(family => {
  const trials = heldout.filter(record => record.spec.family === family);
  const correct = trials.filter(record => record.assessment.availability >= .5 && record.assessment.directionErrorDegrees <= 30).length;
  const medianRelativeSpeedError = quantile(trials.map(record => record.assessment.relativeSpeedError), .5);
  return { family, correct, n: trials.length, rate: correct / trials.length, medianRelativeSpeedError,
    medianDirectionErrorDegrees: quantile(trials.map(record => record.assessment.directionErrorDegrees), .5),
    medianAvailability: quantile(trials.map(record => record.assessment.availability), .5),
    passed: correct / trials.length >= .9 && medianRelativeSpeedError <= .35 };
});
const confounds = stationary.map(family => {
  const trials = heldout.filter(record => record.spec.family === family), falseTrials = trials.filter(record => record.assessment.falseTrial).length;
  return { family, falseTrials, n: trials.length, rate: falseTrials / trials.length,
    falseFrames: trials.reduce((sum, record) => sum + record.assessment.falseFrames, 0),
    analyzedFrames: trials.reduce((sum, record) => sum + record.assessment.analyzedFrames, 0), passed: falseTrials / trials.length <= .05 };
});
const summary = {
  format: 'duckfly-neural-map-flow-study', version: 2, startedAt, finishedAt: new Date().toISOString(), elapsedSeconds: (performance.now() - started) / 1000,
  sourceHashes, modelHashes: setup.hashes, model: readout.metadata.model,
  counts: { trials: records.length, calibration: 16, heldout: heldout.length, heldoutSeeds: 30, conditionedStates: conditioned.size, frames: records.reduce((sum, record) => sum + record.frames.length, 0) },
  thresholds: { minimumGradient, minimumExplained: .2, maximumSpeed: 360, falseTurnDegreesPerSecond: 3 },
  moving: movingResults, confounds, ablations,
  timing: { neuralIntervalMs: stats(intervalCosts), extractionMs: stats(extractionCosts), decoderMs: stats(decoderCosts), conditioningMs: stats(fadeCosts) },
  gates: { moving: movingResults.every(result => result.passed), confounds: confounds.every(result => result.passed),
    ablations: ablations.every(result => result.passed), rendererAdmission: movingResults.every(result => result.passed) && confounds.every(result => result.passed) && ablations.every(result => result.passed), bodyPromoted: false },
  interpretation: 'Engineered motion equation applied to real signed neural maps. Synthetic evidence; no HS/VS reconstruction or demonstrated body improvement. Every held-out failure retained.',
};
fs.writeFileSync(path.join(destination, 'inputs.f32.gz'), gzipSync(Buffer.concat(inputChunks)));
fs.writeFileSync(path.join(destination, 'trials.json.gz'), gzipSync(JSON.stringify(records)));
fs.writeFileSync(path.join(destination, 'metadata.json'), JSON.stringify({ spatialMetadata: spatialToJSON(readout.metadata),
  inputOrder: 'trial, frame, 721 model input-coordinate samples; little-endian Float32',
  neuralHashOrder: 'every frame; T4a,T4b,T4c,T4d,T5a,T5b,T5c,T5d; signed raw Float32 maps in metadata order',
}, null, 2));
summary.evidence = Object.fromEntries(['inputs.f32.gz', 'trials.json.gz', 'metadata.json', 'calibration.json'].map(file => {
  const contents = fs.readFileSync(path.join(destination, file)); return [file, { sha256: hash(contents), bytes: contents.length }];
}));
fs.writeFileSync(path.join(destination, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
