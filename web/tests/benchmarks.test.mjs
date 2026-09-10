import test from 'node:test';
import assert from 'node:assert/strict';
import { promotionDecision,TRAIN_CASES,HELD_OUT_CASES } from '../src/lab/benchmarks.js';
test('held-out promotion rejects a regression or new fall even with positive average gain',()=>{
  const baseline=[{seed:'left',score:.5,fallen:false},{seed:'right',score:.5,fallen:false}];
  assert.equal(promotionDecision(baseline,[{seed:'left',score:.9,fallen:false},{seed:'right',score:.3,fallen:false}]).promote,false);
  assert.equal(promotionDecision(baseline,[{seed:'left',score:.9,fallen:true},{seed:'right',score:.6,fallen:false}]).promote,false);
  assert.equal(promotionDecision(baseline,[{seed:'left',score:.55,fallen:false},{seed:'right',score:.54,fallen:false}]).promote,true);
  assert.throws(()=>promotionDecision(baseline,[{seed:'right',score:.9,fallen:false},{seed:'left',score:.6,fallen:false}]));
  assert.ok(TRAIN_CASES.every(t=>!HELD_OUT_CASES.some(e=>e.seed===t.seed||JSON.stringify(e.target)===JSON.stringify(t.target))));
});
