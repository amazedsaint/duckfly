import fs from 'node:fs';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {SparseVisionModel} from '../../shared/vision/sparse-runtime.js';
import {coordinatePermutation,RETINA} from '../../shared/vision/retina.js';
const root=new URL('../../shared/vision/',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),hash=b=>createHash('sha256').update(b).digest('hex');
const m=JSON.parse(read('models/flyvis-000/manifest.json')),arrays={};
for(const [name,meta] of Object.entries(m.arrays)){const bytes=gunzipSync(read('models/flyvis-000/'+meta.file));if(hash(bytes)!==meta.sha256)throw Error('Parameter hash mismatch');const b=new Uint8Array(bytes).buffer;arrays[name]=meta.dtype==='<u4'?new Uint32Array(b):new Float32Array(b);}
const model=await SparseVisionModel.create(read('wasm/core.wasm'),m,arrays),permutation=coordinatePermutation(m.inputCoordinates);
const bin=(u,v,nx,ny)=>Math.min(nx-1,Math.max(0,Math.floor((u+v/2+15.01)/30.02*nx)))+nx*Math.min(ny-1,Math.max(0,Math.floor((v+15.01)/30.02*ny)));
function aggregate(values,coordinates,nx,ny){const sum=new Float64Array(nx*ny),n=new Float64Array(nx*ny);coordinates.forEach(([u,v],i)=>{const b=bin(u,v,nx,ny);sum[b]+=values[i];n[b]++;});return Array.from(sum,(v,i)=>v/(n[i]||1));}
for(const split of ['train','validation']){
 const path=new URL('reports/eye-'+split+(split==='train'?'-v2':'-v1')+'.json.gz',import.meta.url),raw=fs.readFileSync(path),data=JSON.parse(gunzipSync(raw)),trials=[],costs=[];
 for(const trial of data.trials){
  const eye=model.eye(model.arrays.bias),frames=[];let activity;
  try{
   const initial=Float32Array.from(permutation,i=>trial.frames[0].retina[i]);
   for(let j=0;j<500;j++)activity=eye.step(Float32Array.from(initial,v=>.5+(v-.5)*j/499));
   for(let j=0;j<trial.frames.length;j++){
    const frame=trial.frames[j],retina=Float32Array.from(permutation,i=>frame.retina[i]),start=performance.now();
    // Advance with the preceding image up to this capture, then expose the new
    // image for one integration step. No future frames enter the representation.
    if(j){const prev=trial.frames[j-1],steps=Math.round((frame.time-prev.time)/m.dt);for(let k=0;k<steps-1;k++)activity=eye.step(Float32Array.from(permutation,i=>prev.retina[i]));}
    activity=eye.step(retina);costs.push(performance.now()-start);
    const features=Object.entries(m.readouts).flatMap(([type,indices])=>aggregate(indices.map(i=>activity[i]),m.readoutCoordinates[type],4,2));
    const rawFeatures=aggregate(frame.retina,RETINA.map(c=>[c.u,c.v]),8,8);
    frames.push({time:frame.time,raw:rawFeatures,flyvis:features,target:[Number(frame.target.visible),frame.target.visible?frame.target.bearing:0],fallen:frame.fallen});
   }
  }finally{eye.dispose();}
  trials.push({id:trial.id,family:trial.family,frames});console.log(split,trial.id,frames.length);
 }
 const sorted=costs.toSorted((a,b)=>a-b),report={format:'duckfly-flyvis-feature-screen',version:1,split,inputSha256:hash(raw),sourceCommit:m.sourceCommit,checkpointSha256:m.checkpointSha256,dt:m.dt,sourceSha256:hash(fs.readFileSync(new URL('flyvis-features.mjs',import.meta.url))),features:64,targets:'Predict existing central-camera marker detector visibility and bearing from grayscale retina; proxy assay, not biological truth',costMs:{median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]},trials};
 fs.writeFileSync(new URL('reports/features-'+split+'.json.gz',import.meta.url),gzipSync(JSON.stringify(report)));
}
model.dispose();
