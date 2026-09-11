import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {SparseVisionModel} from '../../shared/vision/sparse-runtime.js';
const base=new URL('../../shared/vision/',import.meta.url),read=p=>fs.readFileSync(new URL(p,base));
const floats=p=>new Float32Array(new Uint8Array(gunzipSync(read(p))).buffer);
test('full Flyvis WASM preserves pinned oracle, long continuation and independent eyes',async()=>{
 const m=JSON.parse(read('models/flyvis-000/manifest.json')),oracle=JSON.parse(read('fixtures/oracle.json')),arrays={};
 for(const [name,meta] of Object.entries(m.arrays)){const b=new Uint8Array(gunzipSync(read('models/flyvis-000/'+meta.file))).buffer;arrays[name]=meta.dtype==='<u4'?new Uint32Array(b):new Float32Array(b);}
 const model=await SparseVisionModel.create(read('wasm/core.wasm'),m,arrays),eye=model.eye(),other=model.eye(),input=floats('fixtures/'+oracle.input);let saved,expected;
 try{for(let step=0;step<oracle.steps;step++){
   const result=eye.step(input.subarray(step*721,(step+1)*721));if(step===119)saved=eye.checkpoint();if(step===120)expected=eye.checkpoint();
   if(oracle.states[step]){const golden=floats('fixtures/'+oracle.states[step].file);for(let i=0;i<golden.length;i++)assert.ok(Math.abs(result[i]-golden[i])<=oracle.atol+oracle.rtol*Math.abs(golden[i]),`Oracle mismatch at ${step}/${i}`);}
 }
 eye.restore(saved);assert.deepEqual(eye.step(input.subarray(120*721,121*721)),expected);assert.deepEqual(other.checkpoint(),arrays.steadyState);
 }finally{model.dispose();}
});
