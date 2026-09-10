import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {SparseVisionModel} from '../../shared/vision/sparse-runtime.js';
const path=new URL('./artifacts/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',path))),arrays={};
for(const [name,meta] of Object.entries(manifest.arrays)){
  const b=gunzipSync(fs.readFileSync(new URL(meta.file,path)));
  if(createHash('sha256').update(b).digest('hex')!==meta.sha256)throw Error(`Hash mismatch: ${name}`);
  const data=new Uint8Array(b).buffer;arrays[name]=meta.dtype==='<u4'?new Uint32Array(data):new Float32Array(data);
}
const model=await SparseVisionModel.create(fs.readFileSync(new URL('../../shared/vision/wasm/core.wasm',import.meta.url)),manifest,arrays),eye=model.eye();
const warm=model.eye(arrays.bias);for(let i=0;i<500;i++)warm.step(new Float32Array(721).fill(.5));const fadeInError=Math.max(...warm.checkpoint().map((v,i)=>Math.abs(v-arrays.steadyState[i])));warm.dispose();if(fadeInError>2e-5)throw Error('Fade-in parity failed');
const n=manifest.nodes,steps=arrays.fixtureInput.length/721,errors=[],cost=[];let checkpoint,replay=[];
// Tolerance chosen before execution. Fail without copying into the app if exceeded.
const atol=2e-5,rtol=2e-5;let passed=true,maxAbsolute=0,maxRelative=0;
for(let t=0;t<steps;t++){
  const input=arrays.fixtureInput.subarray(t*721,(t+1)*721),start=performance.now(),actual=eye.step(input);cost.push(performance.now()-start);
  const fixture=arrays.fixtureTicks.indexOf(t),expected=fixture>=0?arrays.fixtureState.subarray(fixture*n,(fixture+1)*n):null;let error=0;
  for(let i=0;expected&&i<n;i++){const e=Math.abs(actual[i]-expected[i]);error=Math.max(error,e);if(e>atol+rtol*Math.abs(expected[i]))passed=false;maxRelative=Math.max(maxRelative,e/Math.max(1e-6,Math.abs(expected[i])));}
  maxAbsolute=Math.max(maxAbsolute,error);errors.push(error);
  if(t===59)checkpoint=eye.checkpoint();if(t>59&&t<120)replay.push(eye.checkpoint());
}
eye.restore(checkpoint);
for(let t=60;t<120;t++){const actual=eye.step(arrays.fixtureInput.subarray(t*721,(t+1)*721));if(actual.some((v,i)=>v!==replay[t-60][i]))throw Error('Checkpoint continuation diverged');}
const second=model.eye();if(second.checkpoint().some((v,i)=>v!==arrays.steadyState[i]))throw Error('Eye state leaked');
const sorted=[...cost].sort((a,b)=>a-b);const report={format:'duckfly-flyvis-parity',version:1,passed,atol,rtol,maxAbsolute,maxRelative,steps,fullStateCheckpoints:arrays.fixtureTicks.length,nodes:n,edges:manifest.edges,dt:manifest.dt,checkpointExact:true,fadeInError,independentEyes:true,ms:{median:sorted[Math.floor(cost.length*.5)],p95:sorted[Math.floor(cost.length*.95)]},errors};
fs.writeFileSync(new URL('parity.json',path),JSON.stringify(report,null,2));model.dispose();console.log(JSON.stringify({...report,errors:undefined},null,2));if(!passed)process.exitCode=1;
