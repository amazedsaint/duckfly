import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spatialToJSON, SPATIAL_POPULATIONS } from '../../shared/vision/readouts/spatial.js';
import { loadPackagedFlyvis, hash } from './load-model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const destination = path.resolve(process.argv[2] ?? path.join(here, 'reports/spatial-v1'));
const read = file => fs.readFileSync(path.join(destination, file));
const summary = JSON.parse(read('summary.json'));
for (const [file, expected] of Object.entries(summary.evidence)) {
  if (hash(read(file)) !== expected.sha256) throw Error(`Evidence changed: ${file}`);
}
for (const [file, expected] of Object.entries(summary.sourceHashes)) {
  if (hash(fs.readFileSync(path.join(here, file))) !== expected) throw Error(`Source changed: ${file}`);
}
const setup = await loadPackagedFlyvis(), { model, readout } = setup;
if (JSON.stringify(setup.hashes) !== JSON.stringify(summary.modelHashes)) throw Error('Model or extraction source changed');
const metadata = JSON.parse(read('metadata.json'));
const records = JSON.parse(gunzipSync(read('trials.json.gz')));
const floats = file => new Float32Array(new Uint8Array(gunzipSync(read(file))).buffer);
const inputs = floats('inputs.f32.gz'), snapshots = floats('snapshots.f32.gz');
const baseline = readout.baseline(setup.arrays.steadyState, {
  id: 'packaged-neutral-fade-in', neuralTime: 0, method: 'packaged-one-second-neutral-fade-in', conditioningSeconds: 1,
});
if (JSON.stringify(spatialToJSON(baseline)) !== JSON.stringify(metadata.baseline)) throw Error('Reference baseline mismatch');
// Cover every family plus each polarity/reversal and each local-flash side.
const selected = process.argv.includes('--all') ? records : records.filter((trial, i) =>
  i === 0 || trial.spec.split === 'heldout' && trial.spec.seed === 1000);
const checked = []; let samples = 0;
try {
  for (const trial of selected) {
    const eye = model.eye();
    try {
      for (let frameId = 0; frameId < trial.inputFrames; frameId++) {
        const offset = trial.inputFloatOffset + frameId * 721;
        const input = inputs.subarray(offset, offset + 721); let activity;
        for (let step = 0; step < 10; step++) activity = eye.step(input);
        const retained = trial.snapshots.find(snapshot => snapshot.frameId === frameId);
        if (!retained) continue;
        const captureTime = frameId * trial.spec.captureDt;
        const spatial = readout.extract(activity, baseline, {
          duckId: 'offline-duck', eyeId: 'right', sourceId: trial.spec.id, frameId,
          captureTime, neuralStartTime: captureTime, neuralEndTime: captureTime + trial.spec.captureDt,
          clock: 'simulation',
        });
        let snapshotOffset = retained.floatOffset;
        for (const type of SPATIAL_POPULATIONS) for (const kind of ['raw', 'delta']) {
          const actual = spatial.populations[type][kind];
          for (let i = 0; i < 721; i++) {
            if (actual[i] !== snapshots[snapshotOffset + i]) {
              throw Error(`Replay differs at ${trial.spec.id}, ${frameId}, ${type}, ${kind}, ${i}`);
            }
          }
          samples += 721; snapshotOffset += 721;
        }
      }
      checked.push(trial.spec.id);
    } finally { eye.dispose(); }
  }
} finally { model.dispose(); }
const report = {
  format: 'duckfly-spatial-evidence-replay', version: 1, passed: true, exact: true,
  sourceSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
  summarySha256: hash(read('summary.json')), samples, checked,
  coverage: process.argv.includes('--all') ? 'all retained trials' : 'calibration exemplar plus all families and paired conditions from held-out seed 1000',
  limitation: 'Default replay covers selected trials; extraction/index equality was checked for every retained snapshot during the original run.',
};
fs.writeFileSync(path.join(destination, 'replay.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
