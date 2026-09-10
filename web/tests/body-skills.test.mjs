import test from 'node:test';import assert from 'node:assert/strict';
import {BodySkills} from '../src/lab/body-skills.js';
import {defaultScene,encodeScene,decodeScene} from '../src/lab/scene.js';
const body={fallen:false,tilt:1,position:[0,0,.115],speed:0},neural={forward:20,gfHeld:false},input={fresh:true,targetVisible:true};
test('visual kick needs sustained neural response; absent or stale input never triggers',()=>{
 const a=new BodySkills();for(let i=0;i<20;i++)assert.equal(a.step(body,neural,{...input,fresh:false},{kickOnSight:true}).active,false);
 for(let i=0;i<20;i++)assert.equal(a.step(body,{forward:0},input,{kickOnSight:true}).active,false);
 for(let i=0;i<4;i++)assert.equal(a.step(body,neural,input,{kickOnSight:true}).active,false);
 assert.equal(a.step(body,neural,input,{kickOnSight:true}).active,true);
 const copy=new BodySkills();copy.restore(JSON.parse(JSON.stringify(a.checkpoint())));
 let kicks=0;for(let i=0;i<250;i++){const s=a.step(body,neural,input,{kickOnSight:true});assert.deepEqual(s,copy.step(body,neural,input,{kickOnSight:true}));kicks+=s.policy==='kick';}
 assert.equal(kicks,25);assert.equal(a.phase,'walk');assert.equal(a.armed,false);
 a.step(body,neural,{fresh:true,targetVisible:false},{kickOnSight:true});assert.equal(a.armed,true);
});
test('recovery clears the fall latch only after a full second of actual stable posture',()=>{
 const a=new BodySkills(),fallen={...body,fallen:true,tilt:85,position:[0,0,.045]};assert.equal(a.request('recover',fallen),true);
 for(let i=0;i<50;i++)assert.equal(a.step(fallen,neural,input).clearFall,undefined);
 for(let i=0;i<49;i++)assert.equal(a.step({...body,fallen:true},neural,input).clearFall,undefined);
 assert.equal(a.step({...body,fallen:true},neural,input).clearFall,true);
});
test('output disconnection and GF immediately cancel pending skills',()=>{
 for(const gf of [true,false]){const a=new BodySkills();a.request('kick',body);const s=a.step(body,{...neural,gfHeld:gf},input,{enabled:gf});assert.equal(s.policy,'walking');assert.equal(s.active,false);assert.equal(a.phase,'walk');}
 const a=new BodySkills();assert.equal(a.request('kick',{...body,fallen:true}),false);assert.throws(()=>a.restore({phase:'kick',ticks:-1}));
});
test('visual skill settings survive a scene link and losing sight cancels a queued kick',()=>{
 const scene=defaultScene('kick');assert.equal(scene.version,5);assert.deepEqual(decodeScene(encodeScene(scene)),scene);
 const a=new BodySkills();for(let i=0;i<5;i++)a.step(body,neural,input,{kickOnSight:true});assert.equal(a.phase,'settle');
 const s=a.step(body,neural,{...input,fresh:false},{kickOnSight:true});assert.equal(s.active,false);assert.equal(a.phase,'walk');
});
