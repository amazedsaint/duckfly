import test from 'node:test';
import assert from 'node:assert/strict';
import { recordedActionEvidence } from '../src/lab/action-evidence.js';
import { framePacket } from '../../shared/vision/frame.js';

function fixture() {
  const packet=framePacket({pixels:new Uint8Array(96*64*4).fill(17),
    views:{left:new Uint8Array(96*64*4).fill(29),right:new Uint8Array(96*64*4).fill(83)},
    sourceId:'eye/duck-1',frameId:5,captureTime:.1,simulationTime:.1});
  const cause={id:'duck-1',vision:{capture:{sourceId:packet.sourceId,frameId:5,captureTime:.1,clock:'simulation',calibration:packet.calibration.id}},
    input:{forward:.12},command:{vx:.2,yaw:.1}};
  return {events:[{tick:6,time:.12,branch:0,causes:[cause]}],frameTape:new Map([[5,{'duck-1':packet}]])};
}
const request={tick:6,branch:0,duckId:'duck-1'};
test('action evidence preserves exact stereo input without mutating recorded state',()=>{
  const experiment=fixture(),before=structuredClone(experiment);
  const result=recordedActionEvidence(experiment,request);
  assert.equal(result.status,'retained');assert.equal(result.sampleTick,5);
  assert.equal(result.frame.views.left[0],29);assert.equal(result.frame.views.right[0],83);
  result.frame.views.left.fill(0);result.cause.command.vx=0;
  assert.deepEqual(experiment,before);
});
test('lookup rejects nearby, future, different-source and different-clock images',()=>{
  for(const mutate of [p=>p.frameId++,p=>p.sourceId='eye/duck-2',p=>p.captureTime=.11,p=>p.clock='media',p=>p.calibration={...p.calibration,id:'another-eye'}]){
    const experiment=fixture();mutate(experiment.frameTape.get(5)['duck-1']);
    assert.equal(recordedActionEvidence(experiment,request).status,'unavailable');
  }
  const experiment=fixture();experiment.frameTape.set(6,experiment.frameTape.get(5));experiment.frameTape.delete(5);
  assert.equal(recordedActionEvidence(experiment,request).status,'unavailable');
});
test('branch, duck and missing-frame requests cannot borrow another action',()=>{
  const experiment=fixture();
  for(const patch of [{branch:1},{duckId:'duck-2'},{tick:7},{tick:NaN}])
    assert.equal(recordedActionEvidence(experiment,{...request,...patch}).status,'unavailable');
  experiment.frameTape.clear();assert.match(recordedActionEvidence(experiment,request).reason,/expired/);
});
test('webcam identity survives stale repeated deliveries; packets stay independently owned',()=>{
  const experiment=fixture(),packet=experiment.frameTape.get(5)['duck-1'];
  packet.sourceId='webcam/one';packet.clock='decode-arrival';packet.captureTime=41;
  Object.assign(experiment.events[0].causes[0].vision.capture,{sourceId:packet.sourceId,clock:packet.clock,captureTime:41,age:.6,accepted:false});
  experiment.frameTape=new Map([[3,{webcam:packet}],[5,{webcam:{...structuredClone(packet),age:.6}}]]);
  const result=recordedActionEvidence(experiment,request);
  assert.equal(result.status,'retained');assert.equal(result.cause.vision.capture.accepted,false);
  assert.equal(result.frame.captureTime,41);assert.equal(result.cause.vision.capture.age,.6);
});
test('conflicting images with an identical recorded identity are unavailable',()=>{
  const experiment=fixture(),other=structuredClone(experiment.frameTape.get(5));
  other['duck-1'].pixels[0]=200;experiment.frameTape.set(4,other);
  assert.match(recordedActionEvidence(experiment,request).reason,/Conflicting images/);
});
test('malformed retained causes cannot throw through the read-only worker route',()=>{
  for(const causes of [null,[null],[],{}]){
    const experiment=fixture();experiment.events[0].causes=causes;
    assert.equal(recordedActionEvidence(experiment,request).status,'unavailable');
  }
});
