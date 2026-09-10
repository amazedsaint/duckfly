import test from 'node:test';
import assert from 'node:assert/strict';
import {loopStatus} from '../src/lab/loop-status.js';
import {defaultScene,validateScene,encodeScene,decodeScene} from '../src/lab/scene.js';
import {VisionEncoder} from '../src/lab/vision.js';

const state=()=>({scene:defaultScene(),tick:100,paused:false,
  body:{ducks:[{id:'duck-1',command:[0,-.12],speed:.002,fallen:false}]},
  agents:{'duck-1':{input:{fresh:true,gate:true,gateReason:'Target absent'},vision:{target:{visible:false,candidatePixels:2}},neural:{vx:.3,yaw:-.12}}},
  event:{time:2,causes:[{id:'duck-1',command:{vx:0,yaw:-.12},provenance:{forward:'Target absent'}}]}});
test('a firing brain cannot be mislabeled as a delivered walk command',()=>{
  const s=state(),r=loopStatus(s,'duck-1');
  assert.equal(r.neural[0],.3);assert.equal(r.command[0],0);
  assert.match(r.perception,/2\/5 pixels/);assert.match(r.status,/lost.*blocked/);
  s.paused=true;assert.match(loopStatus(s,'duck-1').status,/Paused/);
  s.scene.ducks[0].motorEnabled=false;
  assert.equal(loopStatus(s,'duck-1').reason,'Target absent','Paused edits must not rewrite the previous delivered cause');
  s.event.causes[0].provenance.forward='Body command connection off';
  assert.equal(loopStatus(s,'duck-1').reason,'Body command connection off');
});
test('elapsed scoring horizons never label an open scene as finished',()=>{
  const s=state();s.scene=defaultScene('stop-go');s.tick=100000;s.body.time=2000;
  assert.doesNotMatch(loopStatus(s,'duck-1').status,/Finished/);
});
test('per-duck output controls are portable, bounded, and default to old behavior',()=>{
  const scene=defaultScene('flock');scene.ducks[1].motorEnabled=false;scene.ducks[1].motorGain=.25;
  const expected=validateScene(scene);
  assert.equal(expected.version,4);
  assert.deepEqual(decodeScene(encodeScene(scene)),expected);
  assert.equal(scene.ducks[0].motorGain,1);assert.equal(scene.ducks[0].motorEnabled,true);
  assert.throws(()=>validateScene({...scene,ducks:[{...scene.ducks[0],motorGain:1.1}]}));
});
test('lowering the marker threshold to two fails a stray-pixel falsifier',()=>{
  // Candidate: accept any two pink pixels. These are isolated specks, not a beacon.
  const pixels=new Uint8Array(96*64*4);for(const i of [100,5800])pixels.set([240,40,130,255],i*4);
  const v=new VisionEncoder().encode(pixels);
  assert.equal(v.target.candidatePixels,2);
  const relaxedCandidate=v.target.candidatePixels>=2;
  assert.equal(relaxedCandidate,true);assert.equal(v.target.visible,false);
  assert.equal(new VisionEncoder().encode(pixels,96,64,0,'none').target.candidatePixels,0);
});
