import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-web/wasm';
import { LabWorld,mountTemplate } from '../src/lab/lab-world.js';
import { defaultScene,validateScene,encodeScene,decodeScene } from '../src/lab/scene.js';
import { Experiment } from '../src/lab/experiment.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url));
const template=JSON.parse(gunzipSync(read('../../shared/assets/Simulation/lab-template.json.gz')));
const reference=JSON.parse(read('./fixtures/native.json'));
test('scene round trips and rejects invalid or executable fields',()=>{
  const s=defaultScene('flock');assert.deepEqual(decodeScene(encodeScene(s)),s);
  assert.throws(()=>validateScene({...s,ducks:[]}));
  assert.throws(()=>validateScene({...s,ducks:[{...s.ducks[0],id:'"/><include file="bad'}]}));
  assert.throws(()=>validateScene({...s,props:[{...s.props[0],mass:NaN}]}));
});
test('editable shared physics',async t=>{
  ort.env.wasm.numThreads=1;const mj=await loadMujoco();mountTemplate(mj,template);
  const session=await ort.InferenceSession.create(new Uint8Array(read('../../shared/assets/Policies/alpha_walking.onnx')),{executionProviders:['wasm']});
  let w;
  try{
    await t.test('template preserves native geometry and physical walking',async()=>{
      w=new LabWorld(mj,template,session,ort.Tensor,defaultScene('empty'));
      const initial=w.state().ducks[0];
      initial.poses.forEach((p,i)=>p.forEach((v,j)=>assert.ok(Math.abs(v-reference.initial.poses[i][j])<1e-9)));
      for(const expected of reference.trajectory){const s=await w.step({'duck-1':{vx:.3,yaw:0}});s.ducks[0].position.forEach((v,i)=>assert.ok(Math.abs(v-expected.position[i])<.002));}
      for(let i=20;i<250;i++)await w.step({'duck-1':{vx:.3,yaw:0}});
      const s=w.state().ducks[0];assert.equal(s.fallen,false);assert.ok(s.distance>.5);assert.ok(Math.min(...s.onsets)>5);
      console.log('Editable world walking',JSON.stringify({distance:s.distance,tilt:s.tilt,onsets:s.onsets}));
    });
    await t.test('checkpoint restores an identical continuation after JSON export',async()=>{
      const checkpoint=JSON.parse(JSON.stringify(w.checkpoint()));
      assert.ok(checkpoint.integration.some(v=>v!==0),'getState must actually populate its output');
      const trace=[];for(let i=0;i<30;i++){await w.step({'duck-1':{vx:.2,yaw:.2}});trace.push(Array.from(w.d.qpos));}
      w.restore(checkpoint);
      for(const expected of trace){await w.step({'duck-1':{vx:.2,yaw:.2}});assert.deepEqual(Array.from(w.d.qpos),expected);}
    });
    await t.test('bounded head commands move the physical camera while the body stays upright',async()=>{
      w.reset();for(let i=0;i<100;i++)await w.step({'duck-1':{vx:0,yaw:0}});
      const neutral=w.state().ducks[0],before=neutral.joints[7];
      for(let i=0;i<150;i++)await w.step({'duck-1':{vx:0,yaw:0,head:[0,0,.3,0]}});
      const turned=w.state().ducks[0];
      assert.ok(Math.abs(turned.joints[7]-before)>.12,'Head joint must follow the head command');
      assert.equal(turned.fallen,false);assert.ok(turned.tilt<12);
      assert.ok(turned.cameraPose.slice(3).some((v,i)=>Math.abs(v-neutral.cameraPose[i+3])>.05));
      console.log('Head command receipt',JSON.stringify({before,after:turned.joints[7],tilt:turned.tilt}));
    });
    await t.test('two ducks share collisions and have separate motor histories',async()=>{
      w.dispose();const scene=defaultScene('empty');scene.ducks.push({...scene.ducks[0],id:'duck-2',name:'Duck 2',spawn:[.28,0,Math.PI]});
      scene.props.push({id:'ball',kind:'ball',position:[.14,.11,.05],size:[.07,.07,.07],movable:true,mass:.05});
      w=new LabWorld(mj,template,session,ort.Tensor,scene);
      assert.equal(w.m.nu,28);assert.equal(w.m.nq,49);
      const ball=w.props[0];assert.ok(Math.abs(w.m.body_mass[ball.bodyId]-.05)<1e-12);assert.equal(w.m.geom_friction[ball.geomId*3],.8);
      assert.notEqual(w.robots[0].lastAction,w.robots[1].lastAction);
      let collided=false;
      for(let i=0;i<200;i++){const s=await w.step({'duck-1':{vx:.3,yaw:0},'duck-2':{vx:.3,yaw:0}});if(s.collisions.some(v=>v==='duck-1|duck-2'))collided=true;}
      assert.ok(collided,'Ducks must physically contact each other');
      assert.ok(w.collisionCount>0);
      console.log('Shared world contacts',w.collisionCount);
    });
    await t.test('prop mass changes acceleration and edited friction changes sliding',()=>{
      const measure=(mass,friction,sliding)=>{
        const scene=defaultScene('empty');scene.props=[{id:'probe',kind:sliding?'block':'ball',position:[1,1,sliding?.06:1],size:[.12,.12,.12],movable:true,mass,friction}];
        const probe=new LabWorld(mj,template,session,ort.Tensor,scene);
        try{const body=probe.props[0].bodyId,joint=probe.m.body_jntadr[body],dof=probe.m.jnt_dofadr[joint];
          if(sliding)probe.d.qvel[dof]=1.5;else probe.d.xfrc_applied[body*6]=.2;
          for(let i=0;i<(sliding?120:20);i++)mj.mj_step(probe.m,probe.d);
          return probe.state().props[0].position[0]-1;
        }finally{probe.dispose();}
      };
      const light=measure(.05,.8,false),heavy=measure(1,.8,false),slippery=measure(.2,.05,true),grippy=measure(.2,1.5,true);
      console.log('Physical prop response',JSON.stringify({light,heavy,slippery,grippy}));
      assert.ok(light>heavy*10,'Lighter prop must accelerate more under the same force');
      assert.ok(slippery>grippy*2&&slippery>.4,'Low contact friction must permit longer sliding');
    });
    await t.test('frequent forced captures retain an importable replay window',async()=>{
      const circuit=JSON.parse(read('../../shared/assets/Brain/circuit.json'));
      const e=new Experiment({mj,template,session,Tensor:ort.Tensor,circuit},defaultScene());
      try{const frames={'duck-1':new Uint8Array(96*64*4).fill(100)};
        for(let i=0;i<625;i++)await e.step(frames);
        assert.ok(e.frameTape.size<=600);const record=JSON.parse(JSON.stringify(e.export()));e.import(record);assert.equal(e.tick,625);
        e.rewind(e.history[0].tick);await e.step();
      }finally{e.dispose();}
    });
    await t.test('version 1 recording migrates and replays retained legacy camera input',async()=>{
      const circuit=JSON.parse(read('../../shared/assets/Brain/circuit.json'));
      const recording=JSON.parse(read('../../docs/implementation/roundtrip-recording.json'));
      const e=new Experiment({mj,template,session,Tensor:ort.Tensor,circuit},defaultScene());
      try{
        e.import(recording);assert.equal(e.scene.ducks[0].visionModel,'marker-v1');assert.equal(e.tick,107);
        const expected=Array.from(e.world.d.qpos),expectedBrain=e.agents.get(e.scene.ducks[0].id).brain.checkpoint();
        e.rewind(100);while(e.tick<107)await e.step();
        // Archived file was produced in Chromium. Permit cross-engine roundoff only.
        Array.from(e.world.d.qpos).forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-12));const replayed=e.agents.get(e.scene.ducks[0].id).brain.checkpoint();
        assert.ok(Math.abs(replayed.sim.gaitDrive-expectedBrain.sim.gaitDrive)<1e-12);replayed.sim.gaitDrive=expectedBrain.sim.gaitDrive;assert.deepEqual(replayed,expectedBrain);
      }finally{e.dispose();}
    });
    await t.test('live prop paths preserve the brain and clock, replay exactly, and stop when dragged',async()=>{
      const circuit=JSON.parse(read('../../shared/assets/Brain/circuit.json'));
      const e=new Experiment({mj,template,session,Tensor:ort.Tensor,circuit},defaultScene());
      try{
        const frames={'duck-1':new Uint8Array(96*64*4).fill(100)};
        for(let i=0;i<30;i++)await e.step(frames);
        const brain=e.agents.get('duck-1').brain.checkpoint(),position=e.world.state().props[0].position;
        e.setPropBehavior('target-1',{kind:'orbit',speed:.2,range:.4,axis:'y'});
        assert.equal(e.tick,30);assert.deepEqual(e.agents.get('duck-1').brain.checkpoint(),brain);
        assert.deepEqual(e.world.state().props[0].position,position);
        for(let i=0;i<30;i++)await e.step(frames);
        assert.ok(Math.abs(e.world.state().props[0].position[1]-position[1])>.08);
        const recording=JSON.parse(JSON.stringify(e.export()));
        for(let i=0;i<20;i++)await e.step(frames);const expected=e.checkpoint();
        e.import(recording);for(let i=0;i<20;i++)await e.step(frames);assert.deepEqual(e.checkpoint(),expected);
        e.moveProp('target-1',[.7,.2,.13],0);assert.equal(e.scene.props[0].behavior,null);
        for(let i=0;i<20;i++)await e.step(frames);
        assert.deepEqual(e.world.state().props[0].position,[.7,.2,.13]);
        e.scene.props[0].movable=true;
        assert.throws(()=>e.setPropBehavior('target-1',{kind:'patrol'}),/restart/);
      }finally{e.dispose();}
    });
    await t.test('body connection and strength change delivered commands while neural intent survives, including replay',async()=>{
      const circuit=JSON.parse(read('../../shared/assets/Brain/circuit.json'));
      const e=new Experiment({mj,template,session,Tensor:ort.Tensor,circuit},defaultScene('empty'));
      try{
        const frames={'duck-1':new Uint8Array(96*64*4).fill(100)};
        e.stimulus('duck-1','walk');
        for(let i=0;i<30;i++)await e.step(frames);
        e.updateDuck('duck-1',{motorEnabled:false,feedback:false});
        let s=await e.step(frames);
        assert.equal(s.agents['duck-1'].neural.vx,.3);
        assert.deepEqual(s.body.ducks[0].command,[0,0]);
        assert.equal(s.agents['duck-1'].neural.feedback.drive,0);
        assert.equal(s.agents['duck-1'].neural.feedback.phase,0);
        assert.equal(s.event.causes[0].provenance.forward,'Body command connection off');
        const recording=JSON.parse(JSON.stringify(e.export()));
        await e.step(frames);const expected=e.checkpoint();e.import(recording);await e.step(frames);
        assert.deepEqual(e.checkpoint(),expected);
        e.updateDuck('duck-1',{motorEnabled:true,motorGain:.5,feedback:true});
        s=await e.step(frames);
        assert.equal(s.agents['duck-1'].neural.vx,.3);
        assert.equal(s.body.ducks[0].command[0],.15);
        assert.equal(s.event.causes[0].provenance.gain,.5);
        assert.equal(s.agents['duck-1'].neural.feedback.enabled,true);
      }finally{e.dispose();}
    });
    await t.test('experiment rewind replays recorded visual inputs with identical brain and body state',async()=>{
      const circuit=JSON.parse(read('../../shared/assets/Brain/circuit.json'));
      const e=new Experiment({mj,template,session,Tensor:ort.Tensor,circuit},defaultScene());
      try{
        const pixels=new Uint8Array(96*64*4).fill(100);
        for(let y=20;y<38;y++)for(let x=30;x<48;x++)pixels.set([240,40,130,255],(y*96+x)*4);
        const frames={'duck-1':pixels},trace=[];
        for(let i=0;i<150;i++){
          await e.step(e.needsFrames()?frames:null);
          if(i>=100)trace.push({qpos:Array.from(e.world.d.qpos),brain:e.agents.get('duck-1').brain.checkpoint()});
        }
        e.rewind(100);
        assert.equal(e.recordingView().events.at(-1).tick,100);
        assert.deepEqual(e.recordingView().frames,frames);
        for(const expected of trace){await e.step();assert.deepEqual(Array.from(e.world.d.qpos),expected.qpos);assert.deepEqual(e.agents.get('duck-1').brain.checkpoint(),expected.brain);}
        assert.equal(new Set(e.events.map(event=>event.tick)).size,e.events.length,'Replaying must not duplicate causal events');
        e.rewind(100);e.updateDuck('duck-1',{silence:'output'});assert.equal(e.branchNumber,1);assert.equal(e.replaying,false);
        await e.step(frames);assert.deepEqual(e.world.state().ducks[0].command,[0,0]);
        e.moveProp('target-1',[.8,.1,.13],0);
        const recording=JSON.parse(JSON.stringify(e.export()));
        await e.step(frames);const expected=e.checkpoint();
        e.import(recording);
        assert.equal(e.needsFrames(),true,'Importing a moved prop must refresh the camera between regular sample ticks');
        await e.step(frames);assert.deepEqual(e.checkpoint(),expected);
        e.configure(defaultScene());assert.equal(e.branchNumber,0);
      }finally{e.dispose();}
    });
  }finally{w?.dispose();await session.release();}
});
