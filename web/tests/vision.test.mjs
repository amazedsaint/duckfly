import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VisionEncoder,SensoryAdapter,EYE_WIDTH as W,EYE_HEIGHT as H } from '../src/lab/vision.js';
import { Brain } from '../src/brain.js';
const circuit=JSON.parse(fs.readFileSync(new URL('../../shared/assets/Brain/circuit.json',import.meta.url)));
function frame({x=30,y=25,radius=8,color=[240,40,130],shift=0,texture=false}={}){
  const data=new Uint8Array(W*H*4);
  for(let py=0;py<H;py++)for(let px=0;px<W;px++){
    const c=(px-x)**2+(py-y)**2<=radius**2?color:texture?[0,1,2].map(()=>((Math.floor((px-shift)/4)*7+Math.floor(py/5)*11)%17+17)%17*12):[120,120,120];
    data.set([...c,255],(py*W+px)*4);
  }
  return data;
}
test('camera pixels produce target bearing, disappear under occlusion and respect eye covering',()=>{
  const e=new VisionEncoder();let v=e.encode(frame(),W,H,0);assert.ok(v.target.visible);assert.ok(v.target.bearing>0);
  v=e.encode(frame({radius:0}),W,H,.1);assert.equal(v.target.visible,false);
  v=e.encode(frame(),W,H,.2,'right');assert.equal(v.target.visible,false);
});
test('optical flow follows independently translated image texture',()=>{
  const e=new VisionEncoder();e.encode(frame({radius:0,texture:true}),W,H,0);
  const v=e.encode(frame({radius:0,texture:true,shift:2}),W,H,.1);
  assert.ok(v.flow.vectors.length>8);assert.ok(v.flow.x>.12&&v.flow.x<.3);assert.ok(Math.abs(v.flow.y)<.06);
});
test('asymmetric optical flow changes steering input only when enabled',()=>{
  const first=frame({radius:0,texture:true}),shifted=frame({radius:0,texture:true,shift:2}),second=first.slice();
  for(let y=0;y<H;y++)second.set(shifted.subarray((y*W+W/2)*4,(y+1)*W*4),(y*W+W/2)*4);
  const encoder=new VisionEncoder();encoder.encode(first,W,H,0);const vision=encoder.encode(second,W,H,.1);
  assert.ok(vision.flow.right>vision.flow.left+.1);
  const adapter=new SensoryAdapter(),duck={mode:'brain',source:'eyes',flowSteer:false};
  assert.equal(adapter.sense(vision,duck,.1).turn,0);
  assert.ok(adapter.sense(vision,{...duck,flowSteer:true},.1).turn>0);
});
test('active looking searches after a target disappears within the supported head range',()=>{
  const encoder=new VisionEncoder(),adapter=new SensoryAdapter(),duck={mode:'target',source:'eyes',activeLook:true};
  const seen=encoder.encode(frame({x:20}),W,H,0),following=adapter.sense(seen,duck,0);
  assert.ok(following.head[2]>0);
  const absent=encoder.encode(frame({radius:0}),W,H,.1);
  const search=[1,2,3,4,5].map(time=>adapter.sense(absent,duck,time).head[2]);
  assert.ok(search.some(v=>v>0)&&search.some(v=>v<0));assert.ok(search.every(v=>Math.abs(v)<=.35));
  assert.deepEqual(adapter.sense(absent,{...duck,activeLook:false},1).head,[0,0,0,0]);
});
test('webcam motion loom responds to radial expansion of an uncolored texture',()=>{
  const texture=scale=>{const data=new Uint8Array(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const px=Math.floor((x-W/2)/scale+W/2),py=Math.floor((y-H/2)/scale+H/2);
    const v=((Math.floor(px/4)*7+Math.floor(py/5)*11)%17+17)%17*12;data.set([v,v,v,255],(y*W+x)*4);
  }return data;};
  const e=new VisionEncoder();e.encode(texture(1),W,H,0,'both',true);
  const v=e.encode(texture(1.08),W,H,.1,'both',true);
  assert.ok(v.flow.expansion>.2);assert.ok(v.loomL>.15);assert.ok(v.loomR>.15);
});
test('expanding visual threat causes neural stop, and GF intervention removes it',()=>{
  const e=new VisionEncoder(),normal=new Brain(circuit),ablated=new Brain(circuit);
  ablated.intervene('gf');normal.stimulate('walk');ablated.stimulate('walk');
  let stop=false,ablatedStop=false,maxLoom=0;
  for(let i=0;i<100;i++){
    const radius=i<20?2:Math.min(24,2+(i-20)*.45);
    const v=e.encode(frame({x:24,radius,color:[240,30,30]}),W,H,i*.02);
    maxLoom=Math.max(maxLoom,v.loomL);
    stop ||= normal.step(null,v).event.includes('stop reflex');
    ablatedStop ||= ablated.step(null,v).event.includes('stop reflex');
  }
  assert.ok(maxLoom>.5);assert.ok(stop);assert.equal(ablatedStop,false);
});
test('complete neural/RNG checkpoint replays after JSON serialization',()=>{
  const a=new Brain(circuit,'checkpoint-seed');a.stimulate('walk');for(let i=0;i<75;i++)a.step(null);
  const checkpoint=JSON.parse(JSON.stringify(a.checkpoint())),trace=[];
  for(let i=0;i<80;i++)trace.push(a.step({speed:.1,phase:i/80},{turn:.1,loomR:i>50?.5:0}));
  a.restore(checkpoint);
  for(let i=0;i<trace.length;i++)assert.deepEqual(a.step({speed:.1,phase:i/80},{turn:.1,loomR:i>50?.5:0}),trace[i]);
});
test('sensory adapter loses forward intent when camera input is absent or stale',()=>{
  const e=new VisionEncoder(),a=new SensoryAdapter(),duck={mode:'target',source:'webcam',activeLook:true};
  const v=e.encode(frame(),W,H,0);assert.ok(a.sense(v,duck,0).forward>0);
  assert.ok(a.sense(v,duck,1).gate);assert.equal(a.sense(v,duck,1).forward,0);
  assert.ok(a.sense(null,duck,1).gate);
});
