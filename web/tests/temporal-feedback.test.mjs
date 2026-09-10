import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {HazardFeedback} from '../../experiments/temporal/feedback.js';
import {TemporalDecoder} from '../../experiments/temporal/decoder.js';
import {TemporalFeatures} from '../../experiments/temporal/features.js';
const command = {vx: .3, yaw: .2, head: [0, 0, 0, 0]};
const observe = (f, time, risk, extra = {}) => f.observe({time, risk, source: 'duck-eye', ...extra});
const motor = (f, time, speed = .01, gfEvent = false, c = command) => f.motor(c, {time, speed, gfEvent});
test('risk pulses enter the neural route; only a GF event engages a hold', () => {
  const f = new HazardFeedback(.8); observe(f, 0, .9);
  assert.equal(f.sensory(0).loomL, 1); assert.equal(motor(f, 0, .1).vx, .3);
  assert.equal(motor(f, .02, .1, true).vx, 0);
  for (let i = 1; i <= 50; i++) {observe(f, i * .04, .9); f.sensory(i * .04); assert.equal(motor(f, i * .04).vx, 0);}
  assert.equal(f.state.triggers, 1); assert.equal(f.sensory(2).loomL, 0);
});
test('fresh low risk and sustained measured slowing are both required to release', () => {
  const f = new HazardFeedback(.8); observe(f, 0, 1); motor(f, 0, .2, true);
  for (let i = 1; i <= 20; i++) {observe(f, i * .04, .1); assert.equal(motor(f, i * .04, .1).vx, 0);}
  assert.equal(motor(f, .82, .01).vx, 0);
  observe(f, .88, .1); assert.equal(motor(f, .92, .01).vx, 0);
  observe(f, .96, .1); assert.equal(motor(f, .96, .01).vx, .3);
  assert.equal(f.state.releases, 1);
});
test('stale, covered and source-changed cameras cannot reuse clear evidence', () => {
  for (const kind of ['stale', 'covered', 'source']) {
    const f = new HazardFeedback(.8); observe(f, 0, 1); motor(f, 0, .1, true);
    for (let i = 1; i <= 10; i++) {observe(f, i * .04, .1); motor(f, i * .04);}
    if (kind === 'covered') observe(f, .44, 0, {valid: false});
    if (kind === 'source') observe(f, .44, .1, {source: 'other-eye'});
    assert.equal(motor(f, .8).vx, 0);
    for (let i = 0; i < 10; i++) {observe(f, 1 + i * .04, .1); assert.equal(motor(f, 1 + i * .04).vx, 0);}
    observe(f, 1.4, .1); assert.equal(motor(f, 1.4).vx, .3);
  }
});
test('clear evidence has hysteresis; duplicate frames do not advance it', () => {
  const f = new HazardFeedback(.8); observe(f, 0, 1); f.sensory(0); motor(f, 0, .1, true);
  for (let i = 1; i <= 25; i++) {observe(f, i * .04, i % 2 ? .1 : .5); assert.equal(motor(f, i * .04).vx, 0);}
  observe(f, 1.04, .1); assert.equal(observe(f, 1.04, .1), false);
  assert.equal(motor(f, 1.5).vx, 0); assert.equal(f.state.armed, false);
});
test('covering an eye invalidates clear evidence even when the frame clock is unchanged', () => {
  const f = new HazardFeedback(.8); observe(f, 0, 1); motor(f, 0, .2, true);
  for (let i = 1; i <= 12; i++) {observe(f, i * .04, .1); motor(f, i * .04, .2);}
  observe(f, .48, .1, {valid: false});
  assert.equal(f.state.valid, false); assert.equal(f.state.lowSince, null);
  assert.equal(motor(f, .48, .01).vx, 0); assert.equal(motor(f, .64, .01).vx, 0);
});
test('GF silence and disabled feedback do not create a hold; release never creates a command', () => {
  const f = new HazardFeedback(.8); observe(f, 0, 1); f.sensory(0); assert.equal(motor(f, 0, .1, false).vx, .3);
  const timed = new HazardFeedback(.8, false); observe(timed, 0, 1); assert.equal(motor(timed, 0, .1, true).vx, .3);
  motor(f, 0, .1, true);
  for (let i = 1; i <= 20; i++) {observe(f, i * .04, 0); motor(f, i * .04);}
  assert.deepEqual(motor(f, .8, .01, false, {...command, vx: 0, yaw: 0}), {...command, vx: 0, yaw: 0});
});
test('feedback resumes identically after a JSON round trip', () => {
  const a = new HazardFeedback(.8); observe(a, 0, 1); a.sensory(0); motor(a, 0, .1, true);
  for (let i = 1; i <= 8; i++) {observe(a, i * .04, .1); motor(a, i * .04);}
  const b = new HazardFeedback(.8); b.restore(JSON.parse(JSON.stringify(a.checkpoint())));
  for (let i = 9; i <= 24; i++) {
    for (const f of [a, b]) observe(f, i * .04, i < 18 ? .1 : .9);
    assert.deepEqual(a.sensory(i * .04), b.sensory(i * .04));
    assert.deepEqual(motor(a, i * .04), motor(b, i * .04));
    assert.deepEqual(a.checkpoint(), b.checkpoint());
  }
});
test('temporal feature history uses the same stride as training and survives JSON replay', () => {
  const f = new TemporalFeatures();
  f.history = Array.from({length: 13}, (_, i) => Array(264).fill(i));
  assert.deepEqual([0, 1, 2, 3, 4].map(i => f.input()[i * 264]), [0, 3, 6, 9, 12]);
  const restored = new TemporalFeatures(); restored.restore(JSON.parse(JSON.stringify(f.checkpoint())));
  assert.deepEqual(restored.input(), f.input());
  assert.equal(f.input('no-pose')[256], 0); assert.equal(f.input('static')[0], 12);
});
for (const mode of ['temporal', 'static', 'no-pose']) {
  const path = new URL(`../../experiments/temporal/models/v1/${mode}.json`, import.meta.url);
  test(`Python/browser numerical parity: ${mode}`, {skip: !existsSync(path)}, () => {
    const model = new TemporalDecoder(JSON.parse(readFileSync(path)));
    const checks = JSON.parse(readFileSync(new URL(`../../experiments/temporal/models/v1/${mode}-parity.json`, import.meta.url)));
    for (const c of checks) assert.ok(Math.abs(model.predict(c.input) - c.probability) < 1e-5);
    assert.throws(() => model.predict(Array(1320).fill(NaN)), /Invalid temporal input/);
  });
}
