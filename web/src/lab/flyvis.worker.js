import { fetchBytes } from '../assets.js';
import { SparseVisionModel } from '../../../shared/vision/sparse-runtime.js';
import { stimulusMovie } from '../../../shared/vision/stimuli.js';
import { sampleRetina,coordinatePermutation } from '../../../shared/vision/retina.js';
let modelPromise,cancelled=false;
async function load(){
  const base='/assets/Vision/flyvis-000/',manifest=await fetch(base+'manifest.json').then(r=>{if(!r.ok)throw Error('Flyvis model unavailable');return r.json();}),arrays={};
  if(!manifest.validation.numericalParity)throw Error('Model failed its export gate');
  await Promise.all(Object.entries(manifest.arrays).map(async([name,meta])=>{
    const b=await fetchBytes(base+meta.file),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!==meta.sha256)throw Error('Flyvis parameter hash mismatch');
    const buffer=b.slice().buffer;arrays[name]=meta.dtype==='<u4'?new Uint32Array(buffer):new Float32Array(buffer);
  }));
  return SparseVisionModel.create(await fetchBytes('/assets/Vision/core.wasm'),manifest,arrays);
}
self.onmessage=async({data})=>{
  if(data.type==='cancel'){cancelled=true;return;}
  if(data.type!=='run')return;cancelled=false;let eye;
  try{
    self.postMessage({type:'status',message:'Loading verified Flyvis model'});const model=await (modelPromise??=load()),m=model.manifest;
    const permutation=coordinatePermutation(m.inputCoordinates),movie=stimulusMovie(data.stimulus),initial=sampleRetina(movie[0].pixels,movie[0].calibration);
    const remap=retina=>Float32Array.from(permutation,i=>retina[i]);
    eye=model.eye(model.arrays.bias);let activity;
    self.postMessage({type:'status',message:'Fading into the stimulus at the reference 500 Hz'});
    for(let i=0;i<500;i++){activity=eye.step(remap(Float32Array.from(initial,v=>.5+(v-.5)*i/499)));if(i%50===0){await new Promise(r=>setTimeout(r,0));if(cancelled)return;}}
    const baseline=eye.checkpoint(),costs=[],trace=[];
    for(const packet of movie){
      if(cancelled)return;
      const retina=sampleRetina(packet.pixels,packet.calibration),input=remap(retina),start=performance.now();
      for(let i=0;i<20;i++)activity=eye.step(input);costs.push(performance.now()-start);
      const populations=Object.fromEntries(Object.entries(m.readouts).map(([type,indices])=>[type,indices.reduce((sum,i)=>sum+Math.max(0,activity[i]-baseline[i]),0)/indices.length]));
      const result={captureTime:packet.captureTime,neuralTime:packet.captureTime+.04,populations,model:'flyvis-000',gfStop:false,loomL:null,loomR:null};trace.push(result);
      self.postMessage({type:'frame',packet,retina:Array.from(retina),result});await new Promise(r=>setTimeout(r,0));
    }
    const sorted=costs.sort((a,b)=>a-b);self.postMessage({type:'done',report:{format:'duckfly-flyvis-response',version:1,model:'flyvis-000',sourceCommit:m.sourceCommit,checkpointSha256:m.checkpointSha256,stimulus:data.stimulus,integrationDt:m.dt,captureDt:.04,trace,loopTimingMs:{median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]},validation:m.validation,interpretation:'Full Flyvis early visual responses. LPLC2-to-body bridge is not promoted.'}});
  }catch(e){modelPromise=null;self.postMessage({type:'error',message:e.message});}finally{eye?.dispose();}
};
