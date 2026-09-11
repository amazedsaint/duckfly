import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitRidge,predict,MotionController,retinalFlow,scoreDecoder} from './decoders.js';
import {RETINA} from '../../../shared/vision/retina.js';

test('ridge calibration learns sign from examples, rather than a hard-coded neuron direction',()=>{
  const rows=Array.from({length:60},(_,i)=>[(i-30)/30,Math.sin(i)]),target=rows.map(r=>-.3*r[0]);
  const decoder=fitRidge(rows,target,.001);assert.ok(predict(decoder,[.8,0])<-.2);assert.ok(predict(decoder,[-.8,0])>.2);
  assert.throws(()=>fitRidge([[NaN]],[0]),/Invalid/);
});
test('conventional flow changes sign under image-motion reversal and rejects a spatially flat flash',()=>{
  const frame=shift=>Float32Array.from(RETINA,c=>.5+.4*Math.sin((c.azimuth-shift)*Math.PI/12));
  const right=retinalFlow(frame(0),frame(.1),.04),left=retinalFlow(frame(0),frame(-.1),.04);
  assert.ok(right.horizontal>0&&left.horizontal<0);
  const flash=retinalFlow(new Float32Array(721).fill(.2),new Float32Array(721).fill(.8),.04);assert.equal(flash.horizontal,0);
});
test('the retained nearly uniform renderer flash abstains instead of estimating large false motion',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/low-gradient-flash.json',import.meta.url))),decode=s=>new Float32Array(Uint8Array.from(Buffer.from(s,'base64')).buffer);
  assert.ok(Math.hypot(fixture.oldRawFlow.horizontal,fixture.oldRawFlow.vertical)>5);
  const flow=retinalFlow(decode(fixture.previous),decode(fixture.current),fixture.dt);
  assert.equal(flow.available,false);assert.equal(flow.horizontal,0);assert.equal(flow.reason,'insufficient-spatial-gradient');
});
test('neural processing delay prevents early body decisions and checkpoints retain the queue',()=>{
  const a=new MotionController('flyvis-dna');a.command(0);a.observe({captureTime:0,availableAt:.04,flyvis:.3,conventional:-.3});
  assert.equal(a.command(.02).turn,0);const b=new MotionController('flyvis-dna');b.restore(JSON.parse(JSON.stringify(a.checkpoint())));
  assert.deepEqual(a.command(.04),b.command(.04));assert.ok(a.command(.06).turn>0);
  assert.throws(()=>a.observe({captureTime:0,availableAt:.04,flyvis:0,conventional:0}),/Repeated/);
  assert.throws(()=>new MotionController('flyvis-direct').observe({captureTime:1,availableAt:1.02,flyvis:0,conventional:0}),/premature/);
});
test('no-vision removes visual correction while leaving a declared intentional turn unchanged',()=>{
  const c=new MotionController('none-direct');c.command(0);c.observe({captureTime:0,availableAt:.04,flyvis:20,conventional:-20});
  assert.equal(c.command(.04,.25).yaw,.25);assert.equal(c.command(.06,0).yaw,0);
});
test('direction accuracy alone cannot admit a decoder that turns on flicker',()=>{
  const decoder={mean:[0],scale:[1],weights:[0,1]},rows=[];
  for(const family of ['unchanged','flat-flash','flicker','illumination'])for(let i=0;i<20;i++)rows.push({time:1,rate:0,family,flyvis:[family==='flicker'?.2:0]});
  rows.push({time:1,rate:.25,family:'rotation',flyvis:[.25]},{time:1,rate:-.25,family:'rotation',flyvis:[-.25]});
  const score=scoreDecoder(decoder,rows,'flyvis');assert.equal(score.directionAccuracy,1);assert.equal(score.confounds.flicker.falseTurnRate,1);assert.equal(score.passed,false);
});
