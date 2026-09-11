import test from'node:test';
import assert from'node:assert/strict';
import{ClearMarkerTracker}from'./marker-tracker-v2.mjs';
import{markerCases,markerFrame}from'./marker-movies.mjs';
const c=markerCases('calibration',1)[0];
const packet=(time,frameId,sourceId='stream-a')=>({pixels:markerFrame(c,time).pixels,captureTime:time,frameId,sourceId});
test('checkpoint continuation exactly matches uninterrupted tracking',()=>{
 const a=new ClearMarkerTracker();for(let i=0;i<12;i++)a.step(packet(i*.04,i));const state=a.checkpoint(),b=new ClearMarkerTracker();b.restore(state);
 for(let i=12;i<35;i++)assert.deepEqual(b.step(packet(i*.04,i)),a.step(packet(i*.04,i)));
 state.track.x=-100;assert.notEqual(b.checkpoint().track.x,-100);
});
test('stream change clears association and needs fresh acquisition',()=>{
 const t=new ClearMarkerTracker();for(let i=0;i<10;i++)t.step(packet(i*.04,i));assert.equal(t.step(packet(0,0,'stream-b')).visible,false);assert.equal(t.checkpoint().identity,0);
});
test('duplicate capture abstains without mutating history; rollback refuses',()=>{
 const t=new ClearMarkerTracker();for(let i=0;i<10;i++)t.step(packet(i*.04,i));const saved=t.checkpoint();assert.equal(t.step(packet(.36,9)).status,'duplicate');assert.deepEqual(t.checkpoint(),saved);
 assert.throws(()=>t.step(packet(.32,8)),/Out-of-order/);assert.deepEqual(t.checkpoint(),saved);
});
test('long capture gap latches loss and explicit reset starts fresh',()=>{
 const t=new ClearMarkerTracker();for(let i=0;i<10;i++)t.step(packet(i*.04,i));assert.equal(t.step(packet(1,10)).status,'capture-gap');assert.equal(t.step(packet(1.04,11)).visible,false);
 t.reset();assert.equal(t.step(packet(1.08,12)).status,'acquiring');
});
test('ambiguity persists across restore and never exposes predicted position',()=>{
 const ambiguous=markerCases('calibration',1).find(x=>x.family==='same-color-cross'),a=new ClearMarkerTracker();let r;
 for(let i=0;i<50;i++)r=a.step({pixels:markerFrame(ambiguous,i*.04).pixels,captureTime:i*.04,frameId:i,sourceId:'merge'});
 assert.equal(r.status,'identity-ambiguous');assert.equal(r.center,null);const b=new ClearMarkerTracker();b.restore(a.checkpoint());assert.equal(b.step({pixels:markerFrame(ambiguous,2).pixels,captureTime:2,frameId:50,sourceId:'merge'}).visible,false);
});
