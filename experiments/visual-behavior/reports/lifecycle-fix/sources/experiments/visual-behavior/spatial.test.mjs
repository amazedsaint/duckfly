import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createSpatialFlyvisReadout, spatialToJSON, SPATIAL_POPULATIONS } from '../../shared/vision/readouts/spatial.js';
import { RETINA } from '../../shared/vision/retina.js';
import { loadPackagedFlyvis, readVision } from './load-model.mjs';

const setup = await loadPackagedFlyvis();
const { model, readout, manifest, arrays, wasmBytes } = setup;
const interval = {
  duckId: 'test-duck', eyeId: 'right', sourceId: 'test-retina', frameId: 0,
  captureTime: 0, neuralStartTime: 0, neuralEndTime: .04, clock: 'simulation',
};
const floats = path => new Float32Array(new Uint8Array(gunzipSync(readVision(path))).buffer);

test.after(() => model.dispose());

test('real WASM oracle and spatial extraction preserve signed values at every named coordinate', () => {
  const oracle = JSON.parse(readVision('fixtures/oracle.json'));
  const input = floats(`fixtures/${oracle.input}`), eye = model.eye();
  const baseline = readout.baseline(eye.checkpoint(), { id: 'neutral', neuralTime: 0, method: 'packaged-neutral-checkpoint', conditioningSeconds: 1 });
  let saved, expected;
  try {
    for (let tick = 0; tick < oracle.steps; tick++) {
      const activity = eye.step(input.subarray(tick * 721, (tick + 1) * 721));
      if (tick === 119) saved = eye.checkpoint();
      if (tick === 120) expected = eye.checkpoint();
      if (!oracle.states[tick]) continue;
      const golden = floats(`fixtures/${oracle.states[tick].file}`);
      const response = readout.extract(activity, baseline, {
        ...interval, frameId: tick, captureTime: tick * manifest.dt,
        neuralStartTime: tick * manifest.dt, neuralEndTime: (tick + 1) * manifest.dt,
      });
      for (const type of SPATIAL_POPULATIONS) {
        const { nodeIndices, coordinates } = readout.metadata.populations[type];
        const { raw, delta } = response.populations[type];
        for (let i = 0; i < 721; i++) {
          const node = nodeIndices[i], value = golden[node];
          assert.ok(Math.abs(raw[i] - value) <= oracle.atol + oracle.rtol * Math.abs(value));
          assert.equal(raw[i], activity[node]);
          assert.equal(delta[i], Math.fround(activity[node] - baseline.populations[type][i]));
          assert.deepEqual([coordinates[i].u, coordinates[i].v], manifest.readoutCoordinates[type][i]);
          const coordinate = RETINA.find(c => c.u === coordinates[i].u && c.v === coordinates[i].v);
          assert.equal(coordinate.azimuth, coordinates[i].azimuth);
          assert.equal(coordinate.elevation, coordinates[i].elevation);
        }
      }
    }
    eye.restore(saved);
    assert.deepEqual(eye.step(input.subarray(120 * 721, 121 * 721)), expected);
  } finally { eye.dispose(); }
});

test('raw, baseline and delta remain signed and own their memory after WASM advances', () => {
  const initial = arrays.steadyState.slice(), activity = initial.slice();
  activity[manifest.readouts.T4a[360]] = -2;
  activity[manifest.readouts.T5b[45]] = 3;
  const baseline = readout.baseline(initial, { id: 'signed', neuralTime: 0, method: 'test-reference' });
  const response = readout.extract(activity, baseline, interval);
  assert.equal(response.populations.T4a.raw[360], -2);
  assert.ok(response.populations.T4a.delta[360] < 0);
  assert.ok(response.populations.T5b.delta[45] > 0);
  const copy = structuredClone(response);
  activity.fill(40); initial.fill(80);
  assert.deepEqual(response, copy);
  assert.throws(() => { baseline.populations.T4a[0] = 2; }, TypeError);
  assert.throws(() => { readout.metadata.populations.T4a.coordinates[0].u = 99; }, TypeError);
  const json = spatialToJSON(response);
  assert.ok(Array.isArray(json.populations.T4a.raw));
  assert.deepEqual(JSON.parse(JSON.stringify(json)), json);
});

test('invalid frames, clocks, state lengths and foreign baselines fail closed', () => {
  const baseline = readout.baseline(arrays.steadyState, { id: 'valid', neuralTime: 0, method: 'neutral' });
  for (const patch of [
    { duckId: '' }, { eyeId: '' }, { sourceId: '' }, { frameId: -1 }, { frameId: .5 },
    { captureTime: NaN }, { captureTime: .05 }, { neuralEndTime: 0 },
    { neuralEndTime: .003 }, { neuralStartTime: -.01 }, { clock: '' },
  ]) assert.throws(() => readout.extract(arrays.steadyState, baseline, { ...interval, ...patch }));
  assert.throws(() => readout.extract(arrays.steadyState, spatialToJSON(baseline), interval), /Baseline/);
  assert.throws(() => readout.extract(new Float32Array(721), baseline, interval), /Float32/);
  const bad = arrays.steadyState.slice(); bad[40000] = NaN;
  assert.throws(() => readout.extract(bad, baseline, interval), /finite/);
});

test('baseline JSON restore is exact, owned, and rejects foreign identities or malformed maps', () => {
  const baseline = readout.baseline(arrays.steadyState, { id: 'restore', neuralTime: 0, method: 'neutral', conditioningSeconds: 1 });
  const serialized = JSON.parse(JSON.stringify(spatialToJSON(baseline)));
  const restored = readout.restoreBaseline(serialized);
  assert.deepEqual(restored, baseline);
  assert.deepEqual(readout.extract(arrays.steadyState, restored, interval), readout.extract(arrays.steadyState, baseline, interval));
  serialized.populations.T4a[0] = 100;
  assert.equal(restored.populations.T4a[0], baseline.populations.T4a[0]);
  for (const mutate of [
    value => { value.modelId = 'other-model'; },
    value => { value.checkpointSha256 = '0'.repeat(64); },
    value => { value.manifestCanonicalSha256 = '0'.repeat(64); },
    value => { value.units = 'spikes'; },
    value => { value.neuralTime = -1; },
    value => { value.conditioningSeconds = NaN; },
    value => { delete value.populations.T5d; },
    value => { value.populations.T5a[0] = Infinity; },
    value => { value.populations.T5a.pop(); },
    value => { value.populations.T5a[0] = .1; },
  ]) {
    const changed = spatialToJSON(baseline); mutate(changed);
    assert.throws(() => readout.restoreBaseline(changed));
  }
});

test('model identity validation rejects index, coordinate, checkpoint, array and WASM corruption', async () => {
  for (const corrupt of [
    m => { m.readouts.T4a[0] = -1; },
    m => { m.readouts.T4a[0] = m.readouts.T4a[1]; },
    m => { m.readoutCoordinates.T4a[0] = m.readoutCoordinates.T4a[1]; },
    m => { [m.readoutCoordinates.T4a[0], m.readoutCoordinates.T4a[1]] = [m.readoutCoordinates.T4a[1], m.readoutCoordinates.T4a[0]]; },
    m => { m.inputCoordinates.pop(); },
    m => { m.checkpointSha256 = '0'.repeat(64); },
    m => { m.validation.numericalParity = false; },
    m => { delete m.readouts.T5d; },
  ]) {
    const changed = structuredClone(manifest); corrupt(changed);
    await assert.rejects(createSpatialFlyvisReadout({ manifest: changed, arrays, wasmBytes }));
  }
  const bias = arrays.bias.slice(); bias[0] += .01;
  await assert.rejects(createSpatialFlyvisReadout({ manifest, arrays: { ...arrays, bias }, wasmBytes }), /bias hash/);
  const wrongType = Float32Array.from(arrays.inputIndex);
  await assert.rejects(createSpatialFlyvisReadout({ manifest, arrays: { ...arrays, inputIndex: wrongType }, wasmBytes }), /inputIndex array/);
  const corruptedWasm = Uint8Array.from(wasmBytes); corruptedWasm[30] ^= 1;
  await assert.rejects(createSpatialFlyvisReadout({ manifest, arrays, wasmBytes: corruptedWasm }), /WASM/);
});

test('separate eyes and replays do not share recurrent activity or mutable response snapshots', () => {
  const a = model.eye(), b = model.eye(), initial = b.checkpoint();
  const baseline = readout.baseline(initial, { id: 'eyes', neuralTime: 0, method: 'neutral' });
  try {
    for (let i = 0; i < 20; i++) a.step(Float32Array.from(RETINA, cell => cell.azimuth > 0 ? .9 : .1));
    const response = readout.extract(a.checkpoint(), baseline, interval);
    assert.deepEqual(b.checkpoint(), initial);
    assert.ok(response.populations.T5a.raw.some((value, i) => value !== baseline.populations.T5a[i]));
    const checkpoint = a.checkpoint(), snapshot = spatialToJSON(response);
    for (let i = 0; i < 10; i++) a.step(new Float32Array(721).fill(.2));
    assert.deepEqual(spatialToJSON(response), snapshot);
    a.restore(checkpoint);
    assert.deepEqual(spatialToJSON(readout.extract(a.checkpoint(), baseline, interval)), snapshot);
  } finally { a.dispose(); b.dispose(); }
});
