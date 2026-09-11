import { loadFlyvisReference } from './flyvis-runtime.js';
import { stimulusMovie } from '../../../shared/vision/stimuli.js';
import { sampleRetina,coordinatePermutation } from '../../../shared/vision/retina.js';
import { spatialToJSON } from '../../../shared/vision/readouts/spatial.js';
let cancelled=false;
self.onmessage=async({data})=>{
  if(data.type==='cancel'){cancelled=true;return;}
  if(data.type!=='run')return;cancelled=false;let eye;
  try{
    self.postMessage({type:'status',message:'Loading verified Flyvis model'});const {model,readout}=await loadFlyvisReference(),m=model.manifest;
    const permutation=coordinatePermutation(m.inputCoordinates),movie=stimulusMovie(data.stimulus),initial=sampleRetina(movie[0].pixels,movie[0].calibration);
    const remap=retina=>Float32Array.from(permutation,i=>retina[i]);
    eye=model.eye(model.arrays.bias);let activity;
    self.postMessage({type:'status',message:'Fading into the stimulus at the reference 500 Hz'});
    for(let i=0;i<500;i++){activity=eye.step(remap(Float32Array.from(initial,v=>.5+(v-.5)*i/499)));if(i%50===0){await new Promise(r=>setTimeout(r,0));if(cancelled)return;}}
    const baseline=eye.checkpoint(),spatialBaseline=readout.baseline(baseline,{id:'fade-in',neuralTime:0,method:'reference-fade-in',conditioningSeconds:1}),costs=[],trace=[];
    self.postMessage({type:'reference',spatialMetadata:readout.metadata,baseline:spatialToJSON(spatialBaseline)});
    for(const packet of movie){
      if(cancelled)return;
      const retina=sampleRetina(packet.pixels,packet.calibration),input=remap(retina),start=performance.now();
      for(let i=0;i<20;i++)activity=eye.step(input);costs.push(performance.now()-start);
      const populations=Object.fromEntries(Object.entries(m.readouts).map(([type,indices])=>[type,indices.reduce((sum,i)=>sum+Math.max(0,activity[i]-baseline[i]),0)/indices.length]));
      const spatial=spatialToJSON(readout.extract(activity,spatialBaseline,{duckId:'retinal-bench',eyeId:'single',sourceId:packet.sourceId,frameId:packet.frameId,captureTime:packet.captureTime,neuralStartTime:packet.captureTime,neuralEndTime:packet.captureTime+.04,clock:packet.clock}));
      const result={captureTime:packet.captureTime,neuralTime:packet.captureTime+.04,populations,spatial,model:'flyvis-000',gfStop:null,loomL:null,loomR:null};trace.push(result);
      self.postMessage({type:'frame',packet,retina:Array.from(retina),result});await new Promise(r=>setTimeout(r,0));
    }
    const sorted=costs.sort((a,b)=>a-b);self.postMessage({type:'done',report:{format:'duckfly-flyvis-response',version:2,model:'flyvis-000',sourceCommit:m.sourceCommit,checkpointSha256:m.checkpointSha256,stimulus:data.stimulus,integrationDt:m.dt,captureDt:.04,spatialMetadata:readout.metadata,baseline:spatialToJSON(spatialBaseline),trace,loopTimingMs:{median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],scope:'Neural integration only; excludes capture, readout serialization and rendering'},validation:m.validation,interpretation:'Full Flyvis early visual responses with signed spatial maps. Body bridge remains unvalidated; GF is not simulated in this reference.'}});
  }catch(e){self.postMessage({type:'error',message:e.message});}finally{eye?.dispose();}
};
