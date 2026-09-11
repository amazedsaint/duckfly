import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPackagedFlyvis} from './load-model.mjs';

const setup=await loadPackagedFlyvis(),{model,arrays,manifest}=setup;
test.after(()=>model.dispose());
const liveBytes=()=>model.allocations.reduce((sum,[,count])=>sum+count*4,0);

test('disposed eye handles cannot read or overwrite a replacement at the same WASM pointer',()=>{
  const fixedCount=model.allocations.length,fixedBytes=liveBytes(),original=model.eye(arrays.bias);
  const originalPointer=model.allocations.at(-3)[0];
  original.dispose();original.dispose();
  assert.equal(model.states.size,0);assert.equal(model.allocations.length,fixedCount);assert.equal(liveBytes(),fixedBytes);
  const replacement=model.eye(arrays.bias),replacementPointer=model.allocations.at(-3)[0];
  // Confirm actual allocator reuse; a different pointer would not exercise the defect.
  assert.equal(replacementPointer,originalPointer);
  const expected=replacement.checkpoint();
  try{
    assert.throws(()=>original.checkpoint(),/disposed/);
    assert.throws(()=>original.restore(new Float32Array(manifest.nodes).fill(-123.25)),/disposed/);
    assert.throws(()=>original.step(new Float32Array(721).fill(.5)),/disposed/);
    assert.deepEqual(replacement.checkpoint(),expected);
    replacement.step(new Float32Array(721).fill(.7));
    assert.notDeepEqual(replacement.checkpoint(),expected);
    assert.throws(()=>original.checkpoint(),/disposed/);
  }finally{replacement.dispose();}
  assert.equal(model.allocations.length,fixedCount);assert.equal(liveBytes(),fixedBytes);
});

test('stepping and restoring one of sixteen eyes preserves every untouched peer and releases allocations',()=>{
  const fixedCount=model.allocations.length,fixedBytes=liveBytes(),eyes=Array.from({length:16},()=>model.eye(arrays.bias));
  const expected=eyes.map(eye=>eye.checkpoint());
  try{
    assert.equal(model.states.size,16);
    assert.equal(liveBytes()-fixedBytes,16*3*manifest.nodes*4);
    for(let step=0;step<20;step++)eyes[7].step(new Float32Array(721).fill(.8));
    assert.notDeepEqual(eyes[7].checkpoint(),expected[7]);
    for(let index=0;index<eyes.length;index++)if(index!==7)assert.deepEqual(eyes[index].checkpoint(),expected[index]);
    eyes[7].restore(expected[7]);
    for(let index=0;index<eyes.length;index++)assert.deepEqual(eyes[index].checkpoint(),expected[index]);
  }finally{eyes.forEach(eye=>eye.dispose());}
  assert.equal(model.states.size,0);assert.equal(model.allocations.length,fixedCount);assert.equal(liveBytes(),fixedBytes);
  const reservation=model.core.memory.buffer.byteLength;
  for(let cycle=0;cycle<64;cycle++){const eye=model.eye(arrays.bias);eye.dispose();}
  assert.equal(model.allocations.length,fixedCount);assert.equal(liveBytes(),fixedBytes);assert.equal(model.core.memory.buffer.byteLength,reservation);
});

test('model disposal closes remaining handles and rejects new allocations consistently',()=>{
  const eye=model.eye(arrays.bias);model.dispose();model.dispose();
  assert.equal(model.states.size,0);assert.equal(model.allocations.length,0);assert.equal(liveBytes(),0);
  assert.throws(()=>eye.step(new Float32Array(721).fill(.5)),/disposed/);
  assert.throws(()=>eye.checkpoint(),/disposed/);
  assert.throws(()=>eye.restore(arrays.bias),/disposed/);
  assert.throws(()=>model.eye(),/disposed/);
  assert.throws(()=>model.allocate(new Float32Array(1)),/disposed/);
  eye.dispose();assert.equal(model.allocations.length,0);
});
