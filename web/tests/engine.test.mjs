import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-web/wasm';
import { motorTorque,frictionBudget } from '../src/bam.js';
import { World } from '../src/world.js';
import { Brain } from '../src/brain.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const config=read('../../shared/assets/Simulation/config.json');
const reference=read('./fixtures/native.json');
const circuit=read('../../shared/assets/Brain/circuit.json');
function near(actual,expected,tolerance){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected} within ${tolerance}`);}

test('BAM voltage, back-EMF and directional friction match 128 native vectors',()=>{
  for(const v of reference.bam) {
    near(motorTorque(config.bam,v.target,v.q,v.dq),v.torque,1e-12);
    near(frictionBudget(config.bam,v.motor,v.external,v.dq),v.friction,1e-12);
    near(config.bam.friction_viscous,v.damping,1e-12);
  }
});
test('independent fly brains replay deterministically, with output silence and loom reflex',()=>{
  const a=new Brain(circuit),b=new Brain(circuit);
  for(const brain of [a,b]) brain.stimulate('walk');
  let max=0;
  for(let i=0;i<150;i++){const x=a.step(null),y=b.step(null);assert.deepEqual(x,y);max=Math.max(max,x.forward);}
  assert.ok(max>6);a.silenced=true;assert.equal(a.step(null).vx,0);assert.equal(a.step(null).yaw,0);
  a.silenced=false;a.stimulate('loom');let stopped=false;
  for(let i=0;i<30;i++){const s=a.step(null);if(s.event.includes('stop reflex')){assert.equal(s.vx,0);assert.equal(s.yaw,0);stopped=true;}}
  assert.ok(stopped);
  a.reset();b.reset();assert.deepEqual(a.step(null),b.step(null));
});
test('WebAssembly physics and policy integration',async t=>{
  ort.env.wasm.numThreads=1;
  const mj=await loadMujoco();const vfs=new mj.MjVFS();
  mj.FS.writeFile('/duck.mjb',new Uint8Array(gunzipSync(fs.readFileSync(new URL('../../shared/assets/Simulation/microduck.mjb.gz',import.meta.url)))));
  const model=mj.MjModel.from_binary_path('/duck.mjb',vfs);vfs.delete();mj.FS.unlink('/duck.mjb');
  const session=await ort.InferenceSession.create(new Uint8Array(fs.readFileSync(new URL('../../shared/assets/Policies/alpha_walking.onnx',import.meta.url))),{executionProviders:['wasm']});
  const w=new World(mj,model,config,session,ort.Tensor);
  try {
    await t.test('ONNX WASM matches native outputs on independent inputs',async()=>{
      for(const v of reference.policy){
        const x=new ort.Tensor('float32',Float32Array.from(v.obs),[1,61]);const outputs=await session.run({obs:x});
        outputs.actions.data.forEach((a,i)=>near(a,v.action[i],.00005));
        x.dispose();outputs.actions.dispose();
      }
    });
    await t.test('initial state and short trajectory match native MuJoCo',async()=>{
      const s=w.reset();s.position.forEach((v,i)=>near(v,reference.initial.position[i],1e-12));
      assert.equal(s.poses.length,reference.initial.poses.length);
      s.poses.forEach((p,i)=>p.forEach((v,j)=>near(v,reference.initial.poses[i][j],1e-9)));
      for(const expected of reference.trajectory){const actual=await w.step(.3,0);actual.position.forEach((v,i)=>near(v,expected.position[i],.002));actual.joints.forEach((v,i)=>near(v,expected.joints[i],.025));}
    });
    await t.test('physical walking, contact cycles and deterministic reset',async()=>{
      w.reset();const trace=[];
      for(let i=0;i<500;i++){const s=await w.step(.3,0);if(i<40)trace.push(s.position);}
      const s=w.state(0);assert.equal(s.fallen,false);assert.ok(s.distance>.5);assert.ok(Math.min(...s.onsets)>5);
      console.log('WASM walking receipt',JSON.stringify({distance:s.distance,onsets:s.onsets,tilt:s.tilt}));
      w.reset();for(const expected of trace)assert.deepEqual((await w.step(.3,0)).position,expected);
      await assert.rejects(()=>w.step(NaN,0));w.fallen=true;assert.deepEqual((await w.step(.3,.65)).command,[0,0]);
    });
    await t.test('fly circuit drives real robot and silence zeros both commands',async()=>{
      w.reset();const brain=new Brain(circuit);let body=w.state(0),walking=0;
      for(let i=0;i<650;i++){
        if([50,180,310,440].includes(i))brain.stimulate('walk');
        const b=brain.step(body);if(b.vx>0)walking++;body=await w.step(b.vx,b.yaw);
      }
      assert.ok(walking>100);assert.ok(body.distance>.1);assert.equal(body.fallen,false);
      brain.silenced=true;for(let i=0;i<20;i++){const b=brain.step(body);body=await w.step(b.vx,b.yaw);assert.deepEqual(body.command,[0,0]);}
      console.log('WASM brain receipt',JSON.stringify({distance:body.distance,walkingTicks:walking,tilt:body.tilt}));
    });
  } finally {w.dispose();await session.release();}
});
