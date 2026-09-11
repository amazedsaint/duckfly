import test from 'node:test';
import assert from 'node:assert/strict';
import {EngineeredDisplacementEvent, EngineeredSilhouetteExpansion} from './detectors.mjs';
import {cases, frameTimes, movieFrame} from './movies.mjs';

const sample = family => cases('calibration', 1).find(c => c.family === family);

for (const [Type, family] of [[EngineeredDisplacementEvent, 'small-pass'], [EngineeredSilhouetteExpansion, 'approach-dark']]) {
  test(`${Type.name}: checkpoint preserves the actual remaining movie decisions`, () => {
    const c = sample(family), times = frameTimes(c), a = new Type();
    const midpoint = 13;
    for (const t of times.slice(0, midpoint)) a.step(movieFrame(c, t).pixels, t);
    const b = new Type(); b.restore(JSON.parse(JSON.stringify(a.checkpoint())));
    for (const t of times.slice(midpoint)) assert.deepEqual(a.step(movieFrame(c, t).pixels, t), b.step(movieFrame(c, t).pixels, t));
  });
  test(`${Type.name}: duplicate and reversed clocks cannot introduce an event`, () => {
    const c = sample(family), d = new Type(), p = movieFrame(c, .4).pixels;
    d.step(p, .4); const before = d.checkpoint();
    assert.equal(d.step(p, .4).valid, false);
    assert.deepEqual(d.checkpoint(), before);
    assert.throws(() => d.step(p, .39), /backwards/);
    assert.deepEqual(d.checkpoint(), before);
    const resumed = d.step(movieFrame(c, .9).pixels, .9);
    assert.equal(resumed.event, false, 'capture gaps require a new history');
  });
  test(`${Type.name}: instances and snapshots do not share temporal state`, () => {
    const c = sample(family), a = new Type(), b = new Type();
    const pristine = b.checkpoint();
    for (const t of frameTimes(c)) a.step(movieFrame(c, t).pixels, t);
    assert.deepEqual(b.checkpoint(), pristine);
    const state = a.checkpoint(); if (state.previous) state.previous.x = -999;
    assert.notEqual(a.checkpoint().previous?.x, -999);
    const invalid = a.checkpoint(); invalid.travel = NaN;
    assert.throws(() => b.restore(invalid), /checkpoint/);
  });
  test(`${Type.name}: textured evidence is unavailable rather than a confident negative`, () => {
    const c = sample('textured-small-pass'), d = new Type();
    for (const t of frameTimes(c)) {
      const result = d.step(movieFrame(c, t).pixels, t);
      assert.equal(result.supported, false);
      assert.equal(result.reason, 'nonuniform-border');
      assert.equal(result.event, false);
    }
  });
}

test('event detector reacts to displacement while expansion rejects its time reverse', () => {
  const c = sample('approach-dark'), times = frameTimes(c), frames = times.map(t => movieFrame(c, t).pixels);
  const forward = new EngineeredSilhouetteExpansion(), reverse = new EngineeredSilhouetteExpansion();
  const a = times.map((t, i) => forward.step(frames[i], t));
  const b = times.map((t, i) => reverse.step(frames.at(-1 - i), t));
  assert.equal(a.some(r => r.event), true);
  assert.equal(b.some(r => r.event), false);
});
