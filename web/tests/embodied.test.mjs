import test from 'node:test';
import assert from 'node:assert/strict';
import {EmbodiedCandidate} from '../../experiments/embodied/candidates.js';
const body={heading:0,command:[.3,0],speed:0,contacts:[true,false]};
const input={head:[0,0,0,0],forward:0,turn:0,fresh:true,gate:true};
test('memory affects search direction but cannot invent forward drive or bypass stale/covered eyes',()=>{
 const a=new EmbodiedCandidate('memory'),v={target:{visible:true,bearing:.5},capture:{}};
 a.sense(input,v,{eye:'both'},1,body);
 const lost=a.sense(input,{target:{visible:false}},{eye:'both'},1.2,body);
 assert.ok(lost.turn>0);assert.equal(lost.forward,0);assert.equal(lost.gate,true);
 const wrong=new EmbodiedCandidate('wrong-memory');wrong.sense(input,v,{eye:'both'},1,body);
 assert.ok(wrong.sense(input,{target:{visible:false}},{eye:'both'},1.2,body).turn<0);
 for(const [fresh,eye] of [[false,'both'],[true,'none']])assert.equal(a.sense({...input,fresh},{target:{visible:false}},{eye},1.4,body).turn,0);
 assert.equal(a.sense(input,{target:{visible:false}},{eye:'both'},4,body).turn,0);
 const saved=JSON.parse(JSON.stringify(a.checkpoint())),b=new EmbodiedCandidate('memory');b.restore(saved);
 assert.deepEqual(a.sense(input,v,{eye:'both'},5,body),b.sense(input,v,{eye:'both'},5,body));
});
test('graded intent respects acceleration and immediate GF stop; state replays exactly',()=>{
 const a=new EmbodiedCandidate('graded');let previous=0;
 for(let i=0;i<100;i++){const value=a.afterBrain({vx:.3,forward:110,gfHeld:false}).vx;assert.ok(value>=0&&value<=.3);assert.ok(value-previous<=.012+1e-12);previous=value;}
 const b=new EmbodiedCandidate('graded');b.restore(JSON.parse(JSON.stringify(a.checkpoint())));
 assert.deepEqual(a.afterBrain({vx:0,forward:15,gfHeld:false}),b.afterBrain({vx:0,forward:15,gfHeld:false}));
 assert.equal(a.afterBrain({vx:0,forward:110,gfHeld:true}).vx,0);
});
test('experimental ascending feedback is bounded and disconnectable',()=>{
 let currents=[];const brain={feedback:true,sim:{ascend:[1,2],stimulate:(ids,value)=>currents.push(value)}};
 const a=new EmbodiedCandidate('body-feedback');for(let i=0;i<100;i++)a.beforeBrain(brain,body);
 assert.ok(currents.length>0);assert.ok(currents.every(v=>v>=0&&v<=.04));
 brain.feedback=false;const count=currents.length;a.beforeBrain(brain,body);assert.equal(currents.length,count);
});
