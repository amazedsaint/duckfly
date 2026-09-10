import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stimulusMovie,stimulusFrame,STIMULI } from '../../shared/vision/stimuli.js';
import { framePacket,EYE_CALIBRATION,serializeFrame,deserializeFrame } from '../../shared/vision/frame.js';
import { RETINA,coordinatePermutation,projectReceptor } from '../../shared/vision/retina.js';
import { VisualSystem } from '../src/lab/visual-system.js';
import { SensoryAdapter } from '../src/lab/vision.js';
import { Brain } from '../src/brain.js';
import { validateScene,defaultScene } from '../src/lab/scene.js';
const duck={mode:'brain',source:'eyes',visionModel:'motion-opponency-v1',eye:'both',silence:'none'};
const circuit=JSON.parse(fs.readFileSync(new URL('../../shared/assets/Brain/circuit.json',import.meta.url)));
function run(kind,patch={},gain=10){const encoder=new VisualSystem(),brain=new Brain(circuit,'retinal-falsifier');brain.intervene(patch.silence??'none');brain.sim.setGFGain(gain);let stop=false,peak=0;
  for(const p of stimulusMovie(kind)){const v=encoder.encode(p,p.simulationTime,{...duck,...patch});peak=Math.max(peak,v.loomL,v.loomR);for(let i=0;i<2;i++)stop||=brain.step(null,v).event.includes('stop reflex');}
  return {peak,stop};
}
test('At explicit gain 10, ON/OFF expansion recruits the bounded bridge; flash, translation and appearance do not',()=>{
  for(const s of ['expand-off','expand-on']){const r=run(s);assert.ok(r.peak>.5,`${s}: ${JSON.stringify(r)}`);assert.equal(r.stop,true,s);}
  for(const s of STIMULI.filter(s=>!s.startsWith('expand'))){const r=run(s);assert.equal(r.peak,0,s);assert.equal(r.stop,false,s);}
});
test('upstream motion/LPLC2 interventions and GF ablation have distinct causal effects',()=>{
  for(const silence of ['motion','lplc2'])assert.deepEqual(run('expand-off',{silence}),{peak:0,stop:false});
  const gf=run('expand-off',{silence:'gf'});assert.ok(gf.peak>.5);assert.equal(gf.stop,false);
  assert.deepEqual(run('expand-off',{eye:'none'}),{peak:0,stop:false});
});
test('source labels and simulation slowdown cannot alter calibrated motion estimates',()=>{
  const a=new VisualSystem(),b=new VisualSystem();
  for(const p of stimulusMovie('expand-off')){
    const va=a.encode(p,p.simulationTime,duck),vb=b.encode({...p,sourceId:'another-camera',clock:'media',simulationTime:p.simulationTime/5},p.simulationTime/5,{...duck,source:'webcam'});
    assert.deepEqual(va.eyes,vb.eyes);assert.deepEqual(va.flow,vb.flow);
  }
});
test('duplicate camera frames become stale without advancing motion state; out of order input is rejected',()=>{
  const e=new VisualSystem(),p=stimulusMovie('expand-off')[8];e.encode(p,p.simulationTime,duck);const saved=e.checkpoint();
  const v=e.encode({...p,simulationTime:1,age:1},1,duck);assert.equal(v.capture.accepted,false);assert.deepEqual(e.checkpoint(),saved);
  const input=new SensoryAdapter().sense(v,{...duck,mode:'target',source:'webcam'},1);assert.equal(input.fresh,false);assert.equal(input.forward,0);assert.equal(input.loomL,0);
  const wrong=e.encode({...p,frameId:p.frameId-1},1,duck);assert.equal(wrong.capture.frameId,p.frameId);
});
test('independent eye histories and covered-eye motion',()=>{
  const e=new VisualSystem(),flat=stimulusFrame('flash',0);
  for(const p of stimulusMovie('expand-off')){const v=e.encode({...p,views:{left:p.pixels,right:flat}},p.simulationTime,duck);assert.equal(v.loomR,0);}
  assert.ok(e.last.loomL>.2);
  const next=new VisualSystem();assert.equal(next.last,null);assert.notEqual(next.left,e.left);
});
test('camera packet and full visual state replay after JSON round trip',()=>{
  const movie=stimulusMovie('expand-off'),a=new VisualSystem(),b=new VisualSystem();
  for(const p of movie.slice(0,15))a.encode(p,p.simulationTime,duck);
  b.restore(JSON.parse(JSON.stringify(a.checkpoint())));
  for(const p of movie.slice(15)){const decoded=deserializeFrame(JSON.parse(JSON.stringify(serializeFrame({...p,views:{left:p.pixels,right:p.pixels}}))));assert.deepEqual(decoded.pixels,p.pixels);assert.deepEqual(a.encode(p,p.simulationTime,duck),b.encode(p,p.simulationTime,duck));}
  assert.throws(()=>framePacket({...movie[0],frameId:NaN}));
});
test('retinal index mapping is a coordinate bijection with true hex neighbors',()=>{
  assert.equal(RETINA.length,721);const reversed=[...RETINA].reverse().map(c=>[c.u,c.v]),permutation=coordinatePermutation(reversed);
  for(let i=0;i<721;i++)assert.deepEqual([RETINA[permutation[i]].u,RETINA[permutation[i]].v],reversed[i]);
  assert.throws(()=>coordinatePermutation(Array(721).fill([0,0])));
  const center=RETINA.find(c=>c.u===0&&c.v===0),right=RETINA.find(c=>c.u===1&&c.v===0),up=RETINA.find(c=>c.u===0&&c.v===1);
  assert.ok(projectReceptor(right,EYE_CALIBRATION)[0]>projectReceptor(center,EYE_CALIBRATION)[0]);assert.ok(projectReceptor(up,EYE_CALIBRATION)[1]<projectReceptor(center,EYE_CALIBRATION)[1]);
  assert.ok(Math.abs(Math.hypot(up.azimuth,up.elevation)-right.azimuth)<1e-10);
});
test('scene migration preserves old model semantics; head stabilization has a bounded independent command',()=>{
  const old={...defaultScene(),version:1,ducks:[{id:'duck-1',spawn:[0,0,0]}]};assert.equal(validateScene(old).ducks[0].visionModel,'marker-v1');assert.equal(defaultScene().ducks[0].visionModel,'marker-v1');assert.equal(defaultScene('vision').ducks[0].visionModel,'motion-opponency-v1');
  const a=new SensoryAdapter(),settings={...duck,headStabilization:true};a.sense(null,settings,0,undefined,{heading:0});
  const response=a.sense(null,settings,.02,undefined,{heading:.15});assert.ok(response.head[2]<0);assert.ok(Math.abs(response.head[2])<=.35);assert.equal(response.turn,0);
  const saved=JSON.parse(JSON.stringify(a.checkpoint())),b=new SensoryAdapter();b.restore(saved);assert.deepEqual(a.sense(null,settings,.04,undefined,{heading:.18}),b.sense(null,settings,.04,undefined,{heading:.18}));
});
