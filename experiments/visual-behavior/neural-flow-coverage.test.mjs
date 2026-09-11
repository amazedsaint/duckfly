import test from 'node:test';
import assert from 'node:assert/strict';
import { neuralFlowCoverage, assertNeuralFlowCoverage } from './neural-flow-coverage.mjs';
import { neuralFlowPlan as firstPlan } from './neural-flow-stimuli.mjs';
import { neuralFlowPlan as secondPlan } from './neural-flow-v2-stimuli.mjs';
import { neuralFlowPlan as stratifiedPlan } from './neural-flow-stratified-stimuli.mjs';

test('range admission detects narrow first-draw coverage in both retained random-seed studies', () => {
  for (const plan of [firstPlan(), secondPlan()]) {
    const report = neuralFlowCoverage(plan);
    assert.equal(report.passed, false);
    assert.equal(report.parameters.wavelength.occupiedBins, 1);
    assert.ok(report.parameters.wavelength.fractionOfDeclaredSpan < .02);
    assert.throws(() => assertNeuralFlowCoverage(plan), /failed declared coverage/);
  }
});

test('stratified confirmation covers every interval and uses disjoint seeds and angles', () => {
  const plan = stratifiedPlan(), report = assertNeuralFlowCoverage(plan);
  assert.equal(report.passed, true);
  assert.equal(report.uniqueSeeds, 30);
  const oldSeeds = new Set([...firstPlan(), ...secondPlan()].filter(trial => trial.split === 'heldout').map(trial => trial.seed));
  const oldAngles = new Set([...firstPlan(), ...secondPlan()].filter(trial => trial.split === 'heldout').map(trial => trial.direction));
  for (const trial of plan.filter(trial => trial.split === 'heldout')) {
    assert.ok(!oldSeeds.has(trial.seed)); assert.ok(!oldAngles.has(trial.direction));
  }
  for (const parameter of Object.values(report.parameters)) assert.equal(parameter.occupiedBins, 8);
});
