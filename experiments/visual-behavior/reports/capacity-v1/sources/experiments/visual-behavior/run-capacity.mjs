import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {loadPackagedFlyvis, hash, readVision} from './load-model.mjs';
import {createNeuralMapFlow} from '../../shared/vision/readouts/neural-map-flow-v2.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const destination=path.resolve(process.argv[2]??path.join(here,'reports/capacity-v1'));
if(fs.existsSync(path.join(destination,'summary.json')))throw Error('Refusing to replace retained capacity results');
fs.mkdirSync(destination,{recursive:true});
const started=performance.now(),startedAt=new Date().toISOString();
const sourceFiles=['run-capacity.mjs','CAPACITY-PROTOCOL.md','load-model.mjs'];
const sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,hash(fs.readFileSync(path.join(here,file)))]));
sourceHashes.neuralMapFlowV2=hash(readVision('readouts/neural-map-flow-v2.js'));
const {model,readout,manifest,arrays,hashes}=await loadPackagedFlyvis();
const decoder=createNeuralMapFlow(readout.metadata), minimumGradient=.006455187013519394;
const groupSizes=[1,2,8],warmupIntervals=4,measuredIntervals=64,stepCount=20,intervalSeconds=.04;
const failures=[],groups=[];
const check=(condition,message)=>{if(!condition)failures.push(message);return !!condition;};
const bytes=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
const stateHash=eye=>hash(bytes(eye.checkpoint()));
const allocations=()=>({liveEyes:model.states.size,liveAllocations:model.allocations.length,liveBytes:model.allocations.reduce((sum,[,count])=>sum+count*4,0),reservedWasmBytes:model.core.memory.buffer.byteLength});
const fixed=allocations();
const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*q))];
const stats=values=>({count:values.length,median:quantile(values,.5),p90:quantile(values,.9),p95:quantile(values,.95),p99:quantile(values,.99),min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length});
function workload(){
  const rows=execFileSync('ps',['-axo','pid=,pcpu=,comm='],{encoding:'utf8'}).split('\n').flatMap(line=>{
    const match=line.trim().match(/^(\d+)\s+([\d.]+)\s+(.+)$/);if(!match)return [];
    const command=path.basename(match[3]);
    return [{pid:Number(match[1]),cpuPercent:Number(match[2]),command}];
  });
  return {at:new Date().toISOString(),loadAverage:os.loadavg(),logicalCpuCount:os.cpus().length,ownPid:process.pid,
    relevant:rows.filter(row=>/node|chrome|chromium|codex/i.test(row.command)),
    otherAboveTenPercent:rows.filter(row=>row.cpuPercent>=10&&!/node|chrome|chromium|codex/i.test(row.command))};
}
const initialWorkload=workload();
function retina(eyeIndex,frameIndex){
  const angle=(17+eyeIndex*29)*Math.PI/180,phase=.31+eyeIndex*.47,time=frameIndex*intervalSeconds;
  return Float32Array.from(manifest.inputCoordinates,([u,v])=>{
    const x=2.3*(u+.5*v),y=2.3*Math.sqrt(3)/2*v;
    return .5+.32*Math.sin(2*Math.PI*((x*Math.cos(angle)+y*Math.sin(angle)-84*time)/15.5)+phase);
  });
}
try{
  for(const duckCount of groupSizes){
    const eyeCount=duckCount*2,groupStart=performance.now(),loadBefore=workload(),eyes=[];
    for(let eyeIndex=0;eyeIndex<eyeCount;eyeIndex++){
      const inputs=Array.from({length:warmupIntervals+measuredIntervals+1},(_,frame)=>retina(eyeIndex,frame));
      const eye=model.eye(arrays.bias),fadeStart=performance.now();
      for(let step=0;step<500;step++)eye.step(Float32Array.from(inputs[0],value=>.5+(value-.5)*step/499));
      const initial=eye.checkpoint();
      const baseline=readout.baseline(initial,{id:`capacity-${duckCount}-${eyeIndex}`,neuralTime:0,method:'reference-fade-into-initial-image',conditioningSeconds:1});
      eyes.push({eye,inputs,initial,baseline,conditioningMs:performance.now()-fadeStart,previous:null});
    }
    const initialHashes=eyes.map(item=>stateHash(item.eye));
    eyes[0].eye.step(eyes[0].inputs[1]);
    const independence={changedEyeHash:stateHash(eyes[0].eye),initialHashes,afterSingleStepHashes:eyes.map(item=>stateHash(item.eye))};
    independence.untouchedExact=check(eyes.slice(1).every((item,i)=>stateHash(item.eye)===initialHashes[i+1]),`${duckCount} ducks: stepping one eye changed a peer`);
    independence.steppedEyeChanged=check(independence.changedEyeHash!==initialHashes[0],`${duckCount} ducks: independence probe failed to exercise state`);
    eyes[0].eye.restore(eyes[0].initial);
    independence.restoreExact=check(eyes.every((item,i)=>stateHash(item.eye)===initialHashes[i]),`${duckCount} ducks: restore did not preserve exact independent states`);
    const activeAllocations=allocations(),samples=[];
    for(let interval=0;interval<warmupIntervals+measuredIntervals;interval++){
      const start=performance.now();let coreMs=0,extractionMs=0,decoderMs=0;
      for(let eyeIndex=0;eyeIndex<eyeCount;eyeIndex++){
        const item=eyes[eyeIndex],captureTime=interval*intervalSeconds;let activity;
        let time=performance.now();
        for(let step=0;step<stepCount;step++)activity=item.eye.step(item.inputs[interval]);
        coreMs+=performance.now()-time;time=performance.now();
        const response=readout.extract(activity,item.baseline,{duckId:`duck-${Math.floor(eyeIndex/2)}`,eyeId:eyeIndex%2?'right':'left',sourceId:`capacity-eyes:${eyeIndex}`,frameId:interval,captureTime,neuralStartTime:captureTime,neuralEndTime:captureTime+intervalSeconds,clock:'simulation'});
        extractionMs+=performance.now()-time;time=performance.now();
        if(item.previous)decoder.estimate(item.previous,response,{minimumGradient});
        decoderMs+=performance.now()-time;item.previous=response;
      }
      if(interval>=warmupIntervals)samples.push({interval,groupMs:performance.now()-start,coreMs,extractionMs,decoderMs});
    }
    const finalStateHashes=eyes.map(item=>stateHash(item.eye));
    for(const item of eyes)item.eye.dispose();
    const disposedAllocations=allocations();
    const released=check(disposedAllocations.liveEyes===0&&disposedAllocations.liveAllocations===fixed.liveAllocations&&disposedAllocations.liveBytes===fixed.liveBytes,`${duckCount} ducks: disposed eyes retained live allocations`);
    const result={duckCount,eyeCount,setupMs:performance.now()-groupStart-samples.reduce((sum,sample)=>sum+sample.groupMs,0),conditioningMs:eyes.map(item=>item.conditioningMs),
      independence,activeAllocations,disposedAllocations,released,finalStateHashes,samples,
      groupWallMs:stats(samples.map(sample=>sample.groupMs)),coreGroupMs:stats(samples.map(sample=>sample.coreMs)),
      extractionGroupMs:stats(samples.map(sample=>sample.extractionMs)),decoderGroupMs:stats(samples.map(sample=>sample.decoderMs)),
      currentProcessMemory:process.memoryUsage(),loadBefore,loadAfter:workload()};
    groups.push(result);console.log(JSON.stringify({duckCount,eyeCount,groupWallMs:result.groupWallMs,released}));
  }
  const eye=model.eye(arrays.bias),eyeBeforeDispose=stateHash(eye),oldStatePointer=model.allocations.at(-3)[0];eye.dispose();eye.dispose();
  // Never write into an unallocated block, even when testing a stale handle.
  // Reuse the same block for a controlled replacement eye before the probe.
  const replacement=model.eye(arrays.bias),replacementBefore=stateHash(replacement),replacementStatePointer=model.allocations.at(-3)[0];
  if(replacementStatePointer!==oldStatePointer)throw Error('Stale-handle probe requires a confirmed live replacement at the original pointer');
  const disposedHandleChecks={};
  for(const operation of ['step','checkpoint','restore']){
    try{operation==='step'?eye.step(new Float32Array(721).fill(.5)):operation==='checkpoint'?eye.checkpoint():eye.restore(arrays.bias);disposedHandleChecks[operation]={rejected:false};}
    catch(error){disposedHandleChecks[operation]={rejected:true,error:error.message};}
    check(disposedHandleChecks[operation].rejected,`Disposed eye still permits ${operation}`);
  }
  try{eye.restore(new Float32Array(manifest.nodes).fill(-123.25));}catch{}
  const replacementAfter=stateHash(replacement);
  const staleHandleSafe=check(replacementBefore===replacementAfter,'Disposed stale eye restore mutated replacement eye state');
  replacement.dispose();
  const reservationBeforeCycles=allocations().reservedWasmBytes;
  for(let cycle=0;cycle<64;cycle++){const next=model.eye(arrays.bias);next.dispose();}
  const afterCycles=allocations();
  const reuse=check(afterCycles.liveAllocations===fixed.liveAllocations&&afterCycles.liveBytes===fixed.liveBytes&&afterCycles.reservedWasmBytes===reservationBeforeCycles,'Repeated create/dispose retained allocations or grew reserved memory');
  const lifecycle={disposedHandleChecks,staleHandleSafe,replacementBefore,replacementAfter,replacementStatePointer,oldStatePointer,reservationBeforeCycles,afterCycles,reuse,eyeBeforeDispose};
  model.dispose();
  const finalAllocations=allocations();check(finalAllocations.liveAllocations===0&&finalAllocations.liveBytes===0&&finalAllocations.liveEyes===0,'Disposing model retained live allocations');
  const summary={format:'duckfly-full-reference-stereo-capacity',version:1,startedAt,finishedAt:new Date().toISOString(),elapsedSeconds:(performance.now()-started)/1000,
    sourceHashes,modelHashes:hashes,model:readout.metadata.model,machine:{platform:process.platform,architecture:process.arch,node:process.version,cpu:os.cpus()[0]?.model,logicalCpuCount:os.cpus().length,totalMemoryBytes:os.totalmem()},
    protocol:{duckCounts:groupSizes,stepCount,intervalSeconds,warmupIntervals,measuredIntervals,minimumGradient,executedSequentially:true,scope:'Offline precomputed-retina full core + signed map extraction + v2 decoder, excluding capture/projection/transfer/serialization/UI/physics; not an end-to-end or 25 Hz claim'},
    fixedAllocations:fixed,initialWorkload,groups,lifecycle,finalAllocations,failures,
    gates:{independentEyes:groups.every(group=>group.independence.untouchedExact&&group.independence.restoreExact),releasedEyeAllocations:groups.every(group=>group.released),safeDisposedHandles:failures.every(failure=>!failure.includes('Disposed')),passed:failures.length===0,bodyPromoted:false}};
  fs.writeFileSync(path.join(destination,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({failures,gates:summary.gates,elapsedSeconds:summary.elapsedSeconds}));
}finally{model.dispose();}
