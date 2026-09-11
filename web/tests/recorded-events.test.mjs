import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecordedEvents, changedRecording } from '../src/lab/recorded-events.js';

const event=()=>({tick:6,time:.12,branch:0,causes:[{id:'duck-1',input:{forward:.12,turn:0,loomL:0,loomR:0},neural:{forward:10,left:0,right:0,vx:.3,yaw:0},command:{vx:.3,yaw:0},vision:null}]});
test('malformed recording signals are rejected before an inspector can consume them',()=>{
  for(const mutate of [e=>e.causes=null,e=>e.causes=[null],e=>e.causes[0].input=null,e=>e.causes[0].command.vx=NaN,e=>e.causes[0].neural=[],e=>e.causes[0].vision='bad',e=>e.tick=-1,e=>e.causes[0].connections={signals:null},e=>e.causes[0].connections={signals:[null]}]){
    const bad=event();mutate(bad);assert.throws(()=>validateRecordedEvents([bad]),/Invalid recorded/);
  }
  assert.throws(()=>validateRecordedEvents([event(),event()]),/Duplicate/);
  assert.throws(()=>validateRecordedEvents([event()],{duckIds:['duck-2']}),/signals/);
  assert.throws(()=>validateRecordedEvents([event()],{maximumTick:5}),/action/);
  assert.deepEqual(validateRecordedEvents([event()]),[event()]);
});
test('recording authority changes even when a host resets the identical scene',()=>{
  const previous={authority:'host-a',recordingId:'run-a',sceneKey:'same-scene',tick:500,branch:0};
  assert.equal(changedRecording(previous,{...previous,tick:501}),false);
  for(const patch of [{authority:'host-b'},{recordingId:'run-b'},{sceneKey:'another-scene'},{tick:20},{branch:1}])
    assert.equal(changedRecording(previous,{...previous,...patch}),true);
  assert.equal(changedRecording(null,previous),true);
  assert.equal(changedRecording({...previous,recordingId:null},{...previous,recordingId:null,tick:0}),true);
});
