import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { SPATIAL_POPULATIONS } from '../../shared/vision/readouts/spatial.js';
import { createNeuralMapFlow } from '../../shared/vision/readouts/neural-map-flow-v2.js';
import { loadPackagedFlyvis, hash, readVision } from './load-model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const destination = path.resolve(process.argv[2] ?? path.join(here, 'reports/neural-flow-v2-stratified'));
const read = file => fs.readFileSync(path.join(destination, file));
const summary = JSON.parse(read('summary.json'));
if (hash(fs.readFileSync(path.resolve(destination, summary.referenceCalibration.file))) !== summary.referenceCalibration.sha256) throw Error('Transferred calibration changed');
for (const [file, expected] of Object.entries(summary.evidence)) {
  if (hash(read(file)) !== expected.sha256) throw Error(`Evidence changed: ${file}`);
}
for (const [file, expected] of Object.entries(summary.sourceHashes)) {
  const actual = file === 'neuralMapFlow' ? hash(readVision('readouts/neural-map-flow-v2.js')) : hash(fs.readFileSync(path.join(here, file)));
  if (actual !== expected) throw Error(`Source changed: ${file}`);
}
const setup = await loadPackagedFlyvis(), { model, readout, arrays } = setup;
if (JSON.stringify(setup.hashes) !== JSON.stringify(summary.modelHashes)) throw Error('Model or spatial source changed');
const decoder = createNeuralMapFlow(readout.metadata);
const records = JSON.parse(gunzipSync(read('trials.json.gz')));
const inputs = new Float32Array(new Uint8Array(gunzipSync(read('inputs.f32.gz'))).buffer);
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const selected = process.argv.includes('--all') ? records : records.filter((record, i) => i === 0 || record.spec.seed === 8000);
const checked = [];
try {
  for (const record of selected) {
    const start = record.inputFloatOffset, first = inputs.subarray(start, start + 721), warm = model.eye(arrays.bias);
    let initial;
    try {
      for (let tick = 0; tick < 500; tick++) warm.step(Float32Array.from(first, value => .5 + (value - .5) * tick / 499));
      initial = warm.checkpoint();
    } finally { warm.dispose(); }
    if (hash(bytes(initial)) !== record.initialStateSha256) throw Error('Initial conditioned state differs');
    const eye = model.eye(initial), neuralHash = createHash('sha256'); let previous;
    const baseline = readout.baseline(initial, { id: `initial-${record.initialInputSha256}`, neuralTime: 0, method: 'reference-fade-into-initial-image', conditioningSeconds: 1 });
    try {
      for (const frame of record.frames) {
        const offset = start + frame.frameId * 721, input = inputs.subarray(offset, offset + 721); let activity;
        for (let tick = 0; tick < 10; tick++) activity = eye.step(input);
        const spatial = readout.extract(activity, baseline, {
          duckId: 'neural-flow-duck', eyeId: 'right', sourceId: record.spec.id, frameId: frame.frameId,
          captureTime: frame.captureTime, neuralStartTime: frame.captureTime,
          neuralEndTime: frame.captureTime + record.spec.captureDt, clock: 'simulation',
        });
        for (const type of SPATIAL_POPULATIONS) neuralHash.update(bytes(spatial.populations[type].raw));
        const result = previous ? decoder.estimate(previous, spatial, { minimumGradient: record.spec.split === 'calibration' ? 0 : summary.thresholds.minimumGradient }) : null;
        if (JSON.stringify(result) !== JSON.stringify(frame.result)) throw Error(`Flow replay differs: ${record.spec.id}, frame ${frame.frameId}`);
        previous = spatial;
      }
      if (neuralHash.digest('hex') !== record.neuralRawMapsSha256) throw Error(`Neural map replay differs: ${record.spec.id}`);
      checked.push(record.spec.id);
    } finally { eye.dispose(); }
  }
} finally { model.dispose(); }
const report = {
  format: 'duckfly-neural-map-flow-replay', version: 2, passed: true, exactNeuralMapHashes: true, exactDiagnostics: true,
  studyId: 'neural-flow-v2-stratified',
  sourceSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))), summarySha256: hash(read('summary.json')), checked,
  coverage: process.argv.includes('--all') ? 'all trials' : 'one calibration trial plus every moving/control family at held-out seed 8000',
};
fs.writeFileSync(path.join(destination, 'replay.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
