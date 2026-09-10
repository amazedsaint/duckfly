import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Brain} from '../../web/src/brain.js';
import {HazardFeedback} from './feedback.js';
const circuit = JSON.parse(readFileSync(new URL('../../shared/assets/Brain/circuit.json', import.meta.url)));
const rows = [];
for (const silence of ['none', 'gf', 'output']) for (const pulse of [false, true]) {
  const trials = [];
  for (let seed = 0; seed < 20; seed++) {
    const brain = new Brain(circuit, `temporal-bridge-confirmation-${seed}`), feedback = new HazardFeedback(.8);
    brain.sim.setGFGain(6); brain.intervene(silence); let firstGF = null, everHeld = false, moved = false;
    for (let tick = 0; tick < 125; tick++) {
      const time = tick * .02, before = brain.escapeUntil;
      if (tick % 2 === 0) feedback.observe({risk: pulse && time >= .5 && time < 1.5 ? 1 : 0, time, source: 'probe'});
      const neural = brain.step({speed: .12, phase: (tick * .03) % 1}, {...feedback.sensory(time), forward: .12});
      const gfEvent = brain.escapeUntil > before;
      if (gfEvent && firstGF === null) firstGF = time;
      const command = feedback.motor(neural, {time, speed: .12, gfEvent});
      everHeld ||= feedback.state.held; moved ||= command.vx > 0;
    }
    trials.push({seed, firstGF, everHeld, moved});
    if (silence === 'gf' || !pulse) {assert.equal(firstGF, null); assert.equal(everHeld, false);}
    if (silence === 'none' && pulse) {assert.notEqual(firstGF, null); assert.equal(everHeld, true);}
    if (silence === 'output') assert.equal(moved, false);
  }
  rows.push({silence, pulse, trials});
}
const output = JSON.stringify({complete: true, trials: 120, rows}, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], output, {flag: 'wx'});
console.log('120 bridge checks passed: GF required for hold, output silence preserved.');
