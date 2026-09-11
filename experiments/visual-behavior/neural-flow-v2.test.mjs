import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeuralMapFlow } from '../../shared/vision/readouts/neural-map-flow-v2.js';
import { SPATIAL_POPULATIONS } from '../../shared/vision/readouts/spatial.js';
import { loadPackagedFlyvis } from './load-model.mjs';

const { model, readout } = await loadPackagedFlyvis();
model.dispose();
const decoder = createNeuralMapFlow(readout.metadata);
const make = (time, pattern, id = 'duck') => ({
  modelId: readout.metadata.model.id, checkpointSha256: readout.metadata.model.checkpointSha256,
  duckId: id, eyeId: 'right', sourceId: 'synthetic-map-test', baselineId: 'reference', clock: 'simulation',
  frameId: Math.round(time / .02), captureTime: time, neuralEndTime: time + .02,
  populations: Object.fromEntries(SPATIAL_POPULATIONS.map((type, channel) => [type, {
    raw: Float32Array.from(readout.metadata.populations[type].coordinates, cell => pattern(cell.azimuth, cell.elevation, channel)),
  }])),
});

test('signed translated neural patterns recover image-relative normal motion without subtype labels', () => {
  const pattern = (x, y, channel, shift) => (channel + 1) / 8 * Math.exp(-((x - shift) ** 2 + (y + 2) ** 2) / 120) - .7;
  const a = make(0, (x, y, c) => pattern(x, y, c, 0));
  const b = make(.02, (x, y, c) => pattern(x, y, c, .6));
  const response = decoder.estimate(a, b);
  assert.equal(response.available, true);
  assert.ok(Math.abs(response.velocity.x - 30) < 2, response.velocity.x);
  assert.ok(Math.abs(response.velocity.y) < 1);
  assert.ok(response.explained > .95);
});

test('spatially uniform temporal offsets do not become motion of a static neural pattern', () => {
  const pattern = (x, y, channel) => Math.sin(x / 6) + .2 * Math.cos(y / 8) + channel * .1;
  const a = make(0, pattern), b = make(.02, (x, y, c) => pattern(x, y, c) + .5);
  const response = decoder.estimate(a, b);
  assert.ok(!response.available || response.rawSpeed < .01);
  assert.ok(response.commonModeTemporalRms > 20);
  assert.ok(response.temporalRms < 1e-4);
});

test('freshness and eye/duck/source histories cannot be silently mixed', () => {
  const a = make(0, x => x), b = make(.02, x => x + 1);
  assert.equal(decoder.estimate(a, a).reason, 'no-fresh-image');
  for (const key of ['duckId', 'eyeId', 'sourceId', 'baselineId', 'clock']) {
    assert.equal(decoder.estimate(a, { ...b, [key]: 'other' }).reason, 'history-identity-changed');
  }
  assert.equal(decoder.estimate(a, { ...b, neuralEndTime: 1 }).reason, 'neural-history-gap');
  assert.throws(() => decoder.estimate(a, { ...b, checkpointSha256: 'bad' }), /identity/);
});

test('coarse diagonal stripe maps recover observed normal motion without inventing a tangent', () => {
  for (const wavelength of [11, 15, 19]) for (const angle of [11.25, 56.25, 101.25, 146.25, 191.25, 236.25, 281.25, 326.25]) {
    const ux = Math.cos(angle * Math.PI / 180), uy = Math.sin(angle * Math.PI / 180);
    const pattern = (time, tangentSpeed) => (x, y, c) => {
      const shiftedX = x - (90 * ux - tangentSpeed * uy) * time;
      const shiftedY = y - (90 * uy + tangentSpeed * ux) * time;
      return Math.sin(2 * Math.PI * (shiftedX * ux + shiftedY * uy) / wavelength + c * .1);
    };
    const previous = make(0, pattern(0, 0));
    const response = decoder.estimate(previous, make(.02, pattern(.02, 0)));
    const hiddenTangent = decoder.estimate(previous, make(.02, pattern(.02, 200)));
    const error = Math.abs(((response.direction - angle + 540) % 360) - 180);
    assert.equal(response.available, true);
    assert.equal(response.observedRank, 1);
    assert.equal(response.tangentObserved, false);
    assert.ok(error < 3, `${wavelength}/${angle} direction error ${error}`);
    assert.ok(Math.abs(response.speed - 90) / 90 < .2, response.speed);
    assert.ok(Math.abs(response.velocity.x - hiddenTangent.velocity.x) < 1e-5);
    assert.ok(Math.abs(response.velocity.y - hiddenTangent.velocity.y) < 1e-5);
  }
});
