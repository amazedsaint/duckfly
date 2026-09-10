import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-web/wasm';
import {defaultScene,encodeScene,decodeScene,validateScene} from '../src/lab/scene.js';
import {stopCase,scheduledMotion} from '../src/lab/guided-labs.js';
import {cases,sceneFor} from '../../experiments/temporal/scenes.js';
import {TemporalDecoder} from '../../shared/vision/temporal/decoder.js';
import {TemporalFeatures} from '../../shared/vision/temporal/features.js';
import {TemporalFeatures as ResearchFeatures} from '../../experiments/temporal/features.js';
import {TemporalLoop} from '../../shared/vision/temporal/loop.js';
import {framePacket} from '../../shared/vision/frame.js';
import {Experiment} from '../src/lab/experiment.js';
import {mountTemplate} from '../src/lab/lab-world.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url));
const packet=(tick,source='eyes:duck-1')=>{
  const pixels=Uint8Array.from({length:96*64*4},(_,i)=>(i*17+tick*13)%256);
  return framePacket({pixels,views:{left:pixels,right:pixels},sourceId:source,frameId:tick,captureTime:tick*.02,simulationTime:tick*.02,pose:[0,0,.2,1,0,0,0]});
};
test('guided scenes round trip and preserve matched study geometry without enabling defaults',()=>{
  for(const id of ['stop-go','gaze','switchboard','recovery'])assert.deepEqual(decodeScene(encodeScene(defaultScene(id))),defaultScene(id));
  for(const variant of ['incoming','near-miss','receding','retreat']){
    const original=cases('confirm',16).find(c=>c.index===(variant==='near-miss'?15:variant==='retreat'?0:1)&&c.family===variant), current=stopCase(variant);
    for(const key of Object.keys(current))assert.equal(current[key],original[key]);
    const a=defaultScene('stop-go',{variant}),b=validateScene(sceneFor(original));
    assert.deepEqual(a.props.map(({name,...p})=>p),b.props.map(({name,...p})=>p));assert.equal(a.seed,b.seed);
  }
  for(const id of ['target','empty','loom','vision','flock','occlusion'])assert.ok(defaultScene(id).ducks.every(d=>d.temporal==='off'));
  assert.throws(()=>validateScene({...defaultScene(),lab:{id:'execute-script'}}));
  assert.equal(scheduledMotion({...defaultScene('stop-go').lab,scripted:false},185),null);
});
test('packaged decoder and feature extraction match retained research artifacts',()=>{
  assert.deepEqual(read('../../shared/vision/temporal/no-pose.json'),read('../../experiments/temporal/models/v1/no-pose.json'));
  for(const name of ['decoder.js','feedback.js'])assert.deepEqual(read('../../shared/vision/temporal/'+name),read('../../experiments/temporal/'+name));
  const a=new TemporalFeatures(), b=new ResearchFeatures();
  for(let tick=0;tick<40;tick+=2){const p=packet(tick),body={speed:.12,phase:tick*.05,heading:0};a.observe(p,body);b.observe(p,body);assert.deepEqual(a.input('no-pose'),b.input('no-pose'));}
  const model=new TemporalDecoder(JSON.parse(read('../../shared/vision/temporal/no-pose.json')));
  for(const c of JSON.parse(read('../../experiments/temporal/models/v1/no-pose-parity.json')))assert.ok(Math.abs(model.predict(c.input)-c.probability)<1e-5);
});
test('temporal loop invalidates raw stereo for covered eyes and webcams, retains a GF hold',()=>{
  const d={source:'eyes',eye:'both'},a=new TemporalLoop({threshold:.98,mode:'no-pose',predict:()=>1},'hold');
  a.observe(packet(0),{speed:0,phase:0,heading:0,time:0},d);
  assert.equal(a.sensory(0).loomL,1);a.motor({vx:.3,yaw:0},{speed:0},0,true);
  for(const patch of [{eye:'none'},{eye:'left'},{source:'webcam'}]){
    a.observe(packet(2),{speed:0,phase:0,heading:0,time:.04},{...d,...patch});
    assert.equal(a.status(.04).fresh,false);assert.equal(a.sensory(.04).loomL,0);assert.equal(a.status(.04).held,true);assert.equal(a.features.history.length,0);
  }
});
test('integrated GF loop checkpoints replay exactly, and silence prevents a hold',async()=>{
  const mj=await loadMujoco(),template=JSON.parse(gunzipSync(read('../../shared/assets/Simulation/lab-template.json.gz')));mountTemplate(mj,template);
  ort.env.wasm.numThreads=1;
  const session=await ort.InferenceSession.create(new Uint8Array(read('../../shared/assets/Policies/alpha_walking.onnx')),{executionProviders:['wasm']});
  const runtime={mj,template,session,Tensor:ort.Tensor,circuit:JSON.parse(read('../../shared/assets/Brain/circuit.json')),temporalDecoder:{threshold:.98,mode:'no-pose',predict:()=>1}};
  const step=async e=>e.step(e.needsFrames()?{'duck-1':packet(e.tick)}:null);
  const e=new Experiment(runtime,defaultScene('stop-go'));
  try {
    for(let i=0;i<75;i++)await step(e);
    assert.ok(e.agents.get('duck-1').temporal.status(1.5).held);assert.equal(e.world.robots[0].command[0],0);
    const saved=JSON.parse(JSON.stringify(e.export())),trace=[];
    for(let i=0;i<130;i++){const s=await step(e);trace.push({qpos:Array.from(e.world.d.qpos),event:JSON.parse(JSON.stringify(s.event)),temporal:s.agents['duck-1'].temporal});}
    e.import(saved);
    for(const expected of trace){const s=await step(e);assert.deepEqual({qpos:Array.from(e.world.d.qpos),event:JSON.parse(JSON.stringify(s.event)),temporal:s.agents['duck-1'].temporal},expected);}
    e.updateDuck('duck-1',{eye:'none'});assert.equal(e.agents.get('duck-1').temporal.status(e.tick*.02).fresh,false);assert.equal(e.agents.get('duck-1').temporal.features.history.length,0);
    e.configure(defaultScene('stop-go',{condition:'gf-off'}));for(let i=0;i<80;i++)await step(e);
    assert.equal(e.agents.get('duck-1').temporal.status(1.6).gfEvents,0);assert.equal(e.agents.get('duck-1').temporal.status(1.6).held,false);
    assert.ok(e.world.robots[0].command[0]>0);
    e.world.reset();
    const commands={'duck-1':{vx:.3,yaw:0}};
    for(let i=0;i<100;i++)await e.world.step(commands);
    const bodyCheckpoint=JSON.parse(JSON.stringify(e.world.checkpoint())),results=[];
    for(const force of [0,2.5]){
      e.world.restore(bodyCheckpoint);const robot=e.world.robots[0];robot.pushTicks=10;robot.pushForce=force;
      let maxTilt=0;for(let i=0;i<40;i++){const s=await e.world.step(commands);maxTilt=Math.max(maxTilt,s.ducks[0].tilt);}
      results.push({force,maxTilt,body:e.world.state().ducks[0]});
    }
    assert.ok(Math.abs(results[1].body.position[1]-results[0].body.position[1])>.01,'A matched physical nudge must change lateral displacement');
    assert.equal(results[1].body.fallen,false);
    console.log('Matched 2.5 N nudge',JSON.stringify(results.map(r=>({force:r.force,tilt:r.maxTilt,y:r.body.position[1],fallen:r.body.fallen}))));

  }finally{e.dispose();await session.release();}
});
