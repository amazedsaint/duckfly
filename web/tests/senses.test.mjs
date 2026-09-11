import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-web/wasm';
import {senseEnvironment,normalizeSenses} from '../src/lab/senses.js';
import {defaultScene,validateScene,encodeScene,decodeScene} from '../src/lab/scene.js';
import {TriggerActions,newConnection} from '../src/lab/trigger-actions.js';
import {SensoryAdapter} from '../src/lab/vision.js';
import {Brain} from '../src/brain.js';
import {Experiment} from '../src/lab/experiment.js';
import {mountTemplate} from '../src/lab/lab-world.js';
const read=p=>fs.readFileSync(new URL('../../shared/assets/'+p,import.meta.url));
const circuit=JSON.parse(read('Brain/circuit.json'));
const body={id:'duck-1',heading:0,cameraPose:[0,0,.15],fallen:false};
const state={time:0,collisions:[]};
const scene=defaultScene('scent'),duck=scene.ducks[0];
const sense=(field,settings={},b=body,s=state)=>senseEnvironment({...scene,fields:field?[{id:'scent-1',kind:'odor',radius:.5,strength:1,position:field}]:[]},{...duck,senses:normalizeSenses(settings)},b,s);

test('scent uses local head coordinates, preserves symmetry and isolates each duck',()=>{
  const ahead=sense([.6,0]);assert.equal(ahead.scent.contrast,0);
  const left=sense([.6,.3]),right=sense([.6,-.3]);
  assert.ok(left.scent.contrast>0);assert.equal(left.scent.left,right.scent.right);assert.equal(left.scent.contrast,-right.scent.contrast);
  const shifted=sense([1.6,2.3],{}, {...body,cameraPose:[1,2,.15]});
  assert.ok(Math.abs(shifted.scent.contrast-left.scent.contrast)<1e-14);
  const rotated=sense([-.3,.6],{}, {...body,headPose:[0,0,.15,Math.SQRT1_2,0,0,Math.SQRT1_2]});
  assert.ok(Math.abs(rotated.scent.contrast-left.scent.contrast)<1e-14);
  const off=sense([.6,.3],{antennae:'none'});assert.equal(off.scent.available,false);assert.equal(off.scent.strength,0);
  assert.equal(sense([.6,.3],{antennae:'left'}).scent.right,0);
  assert.equal(sense([.6,.3]).scent.right,left.scent.right,'A second duck must retain its own antenna settings');
  assert.equal(sense(null).scent.detected,false);
});

test('touch requires an external physics contact and ignores the floor and other ducks’ contacts',()=>{
  for(const collisions of [[],['duck-1|floor'],['duck-2|block-1']])assert.equal(sense(null,{},body,{time:0,collisions}).touch.active,false);
  const contact=sense(null,{},body,{time:0,collisions:['block-1|duck-1','duck-1|duck-2']});
  assert.deepEqual(contact.touch.objects,['block-1','duck-2']);
  assert.equal(sense(null,{touch:false},body,{time:0,collisions:['block-1|duck-1']}).touch.active,false);
});

test('nonvisual connections work without camera input while visual signals remain blocked',()=>{
  const context={time:0,duck,body,input:{fresh:false,brainFresh:true,gate:false,senses:sense([.6,.3])},neural:{forward:30,left:0,right:0,yaw:0,gfHeld:false},vision:null};
  const config={enabled:true,rules:[newConnection('scent','walk','smell'),newConnection('lost','look-left','vision')]};
  const result=new TriggerActions().step(config,context);
  assert.equal(result.command.vx,.3);assert.equal(result.command.head[2],0);assert.equal(result.signals[1].blocked,'Camera stale or absent');
  const off={...context,input:{...context.input,senses:sense([.6,.3],{antennae:'none'})}};
  assert.equal(new TriggerActions().step(config,off).command.vx,0);
  config.rules=[newConnection('scent-lost','walk')];
  assert.equal(new TriggerActions().step(config,off).command.vx,0,'Disabled sensing is not the absence of a scent');
  for(const patch of [{motorEnabled:false},{motorGain:0},{silence:'output'}])assert.equal(new TriggerActions().step({...config,rules:[newConnection('scent','walk')]},{...context,duck:{...duck,...patch}}).command.vx,0);
  assert.equal(new TriggerActions().step(config,{...context,neural:{...context.neural,gfHeld:true}}).command.vx,0);
});

test('smell supplies circuit current without a camera, while missing or disabled scent stops the automatic request',()=>{
  const adapter=new SensoryAdapter();
  const active=adapter.sense(null,duck,0,undefined,body,sense([.6,.3]));
  assert.equal(active.fresh,false);assert.equal(active.brainFresh,true);assert.ok(active.forward>0&&active.turn>0);
  for(const sensors of [sense(null),sense([.6,.3],{antennae:'none'})]){
    const absent=adapter.sense(null,duck,0,undefined,body,sensors);assert.equal(absent.forward,0);assert.equal(absent.gate,true);
  }
});

test('air reaches the existing sensory pathway and depends on that pathway',()=>{
  for(const seed of ['air-causal','air-control-2','air-control-3','senses-v1/duck-1']){
    const active=new Brain(circuit,seed),control=new Brain(circuit,seed),cut=new Brain(circuit,seed),weak=new Brain(circuit,seed);
    assert.equal(active.sim.sens.length,16);
    for(const i of cut.sim.sens)cut.sim.silencedNeurons[i]=1;
    const counts=[0,0,0,0];
    for(let i=0;i<100;i++){
      const exposed=i>=25&&i<45;
      for(const [j,brain] of [active,control,cut,weak].entries())counts[j]+=Number(brain.step(null,{forward:.12,air:exposed?[.8,0,.8,.2][j]:0}).gfHeld);
    }
    assert.ok(counts[0]>20,seed+' must respond to the stronger air input');
    assert.deepEqual(counts.slice(1),[0,0,0],seed+' controls must remain clear');
  }
});

test('sensory settings and new signals survive scene sharing and reject malformed imports',()=>{
  for(const name of ['scent','air','touch']){
    const s=defaultScene(name);assert.equal(s.version,9);assert.deepEqual(decodeScene(encodeScene(s)),s);
  }
  assert.throws(()=>validateScene({...scene,ducks:[{...duck,senses:{antennae:'all'}}]}),/sensory/);
  assert.throws(()=>validateScene({...scene,fields:[{...scene.fields[0],strength:Infinity}]}),/strength/);
  assert.equal(defaultScene('target').version,2,'Existing scenes retain their schema');
});

test('sensory scenes drive real physics and replay live source edits exactly',async t=>{
  ort.env.wasm.numThreads=1;const mj=await loadMujoco(),template=JSON.parse(gunzipSync(read('Simulation/lab-template.json.gz')));mountTemplate(mj,template);
  const session=await ort.InferenceSession.create(new Uint8Array(read('Policies/alpha_walking.onnx')),{executionProviders:['wasm']});
  const runtime={mj,template,session,Tensor:ort.Tensor,circuit},frames={'duck-1':new Uint8Array(96*64*4).fill(100)};
  const step=e=>e.step(e.needsFrames()?frames:null);
  try{
    await t.test('eyes-covered pursuit improves source distance and loss of scent removes forward drive',async()=>{
      const e=new Experiment(runtime,scene);try{
        for(let i=0;i<250;i++)await step(e);
        const s=e.state(),b=s.body.ducks[0];assert.equal(b.fallen,false);assert.ok(b.position[0]>.35);assert.ok(s.scores['duck-1'].minGoalDistance<.32);
        e.updateField('scent-1',{strength:0});
        for(let i=0;i<10;i++){const value=await step(e);assert.equal(value.body.ducks[0].command[0],0);assert.equal(value.agents['duck-1'].input.senses.scent.detected,false);}
      }finally{e.dispose();}
    });
    await t.test('source edits and sensor settings replay in order, including JSON export and branching',async()=>{
      const e=new Experiment(runtime,scene);try{
        for(let i=0;i<50;i++)await step(e);
        const checkpoint=e.checkpoint();
        e.updateField('scent-1',{position:[.6,-.3]});
        e.updateDuck('duck-1',{senses:{antennae:'right',air:true,touch:true}});
        for(let i=0;i<12;i++)await step(e);
        e.updateField('scent-1',{strength:.2});
        for(let i=0;i<8;i++)await step(e);
        const expected=e.checkpoint(),saved=JSON.parse(JSON.stringify(e.export()));
        assert.equal(saved.version,6);assert.equal(saved.fieldEdits.length,2);
        e.import(saved);e.restore(checkpoint);while(e.tick<expected.tick)await step(e);
        assert.deepEqual(e.checkpoint(),expected);
        e.restore(checkpoint);e.updateField('scent-1',{strength:0});
        for(let i=0;i<20;i++)await step(e);
        assert.equal(e.state().agents['duck-1'].input.senses.scent.strength,0);
        assert.equal(e.scene.fields[0].strength,0);assert.ok(e.branchNumber>0);
        const bad=structuredClone(saved);bad.fieldEdits[0].patch={radius:-1};assert.throws(()=>e.import(bad),/radius/);
      }finally{e.dispose();}
    });
    await t.test('a real collision activates touch-to-pause while ordinary walking does not',async()=>{
      const e=new Experiment(runtime,defaultScene('touch'));
      const pink=frames['duck-1'].slice();for(let y=20;y<38;y++)for(let x=39;x<57;x++)pink.set([240,40,130,255],(y*96+x)*4);
      let contact=false;
      try{
        for(let i=0;i<350;i++){
          const s=await e.step(e.needsFrames()?{'duck-1':pink}:null),a=s.agents['duck-1'];
          if(i<80)assert.equal(a.input.senses.touch.active,false);
          if(a.input.senses.touch.active){contact=true;assert.equal(a.connections.signals[0].active,true);assert.equal(s.body.ducks[0].command[0],0);}
        }
        assert.ok(contact,'The block must physically contact the duck');assert.equal(e.state().body.ducks[0].fallen,false);
      }finally{e.dispose();}
    });
  }finally{await session.release();}
});
