import{ExperimentalGPUFlyvis}from'./gpu-model.mjs';import{SparseVisionModel}from'./sparse-runtime.js';
const base=new URL('.',import.meta.url),get=async name=>{const r=await fetch(new URL(name,base));if(!r.ok)throw Error(`Fetch failed:${name}`);return r;};
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const encode=a=>{const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),parts=[];for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));return btoa(parts.join(''));};
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function compare(actual,expected){let maxAbsolute=0,maxScaledError=0,violations=0,nonFinite=0,bitDifferences=0;for(let i=0;i<expected.length;i++){if(!Number.isFinite(actual[i]))nonFinite++;const e=Math.abs(actual[i]-expected[i]);maxAbsolute=Math.max(maxAbsolute,e);maxScaledError=Math.max(maxScaledError,e/(2e-5+2e-5*Math.abs(expected[i])));violations+=+(e>2e-5+2e-5*Math.abs(expected[i]));bitDifferences+=+!Object.is(actual[i],expected[i]);}return{elements:expected.length,maxAbsolute,maxScaledError,violations,nonFinite,bitDifferences,pass:!violations&&!nonFinite};}
function input(kind,tick,coordinates,eye=0){
 const t=tick*.002;return Float32Array.from(coordinates,([u,v],i)=>{const x=2.3*(u+v/2),y=2.3*Math.sqrt(3)/2*v;
  if(kind==='neutral')return.5;if(kind==='black')return 0;if(kind==='white')return 1;
  if(kind==='flicker')return t<.12?.5:.5+.45*Math.sin((t-.12)*2*Math.PI*12);
  if(kind==='checker')return((Math.floor((x+t*25)/8)+Math.floor(y/8))%2+2)%2?.9:.1;
  if(kind==='noise'){let n=Math.imul(i+1+eye*997,1664525)^(Math.floor(tick/20)+17)*1013904223;n^=n>>>16;return(n>>>0)/4294967295;}
  const contrast=Math.abs(x-(-18+(t-.12)*70))<4&&Math.abs(y)<12&&t>=.12?.45:0;return.5+(kind==='on-bar'?contrast:-contrast);
 });
}
const distribution=values=>{const s=[...values].sort((a,b)=>a-b);return{samples:values.length,median:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.ceil(s.length*.95)-1)],raw:values};};
export async function runGPUFeasibility({benchmark=false}={}){
 const started=performance.now(),report={experiment:'full-flyvis-webgpu-v1',stage:benchmark?'benchmark':'parity',createdAt:new Date().toISOString(),userAgent:navigator.userAgent,secureContext:isSecureContext,absoluteTolerance:2e-5,relativeTolerance:2e-5,fullStates:[],comparisons:[],ownership:{},benchmark:[],productionPromotion:false};
 const progress=async stage=>{await fetch(new URL('progress',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage,time:new Date().toISOString()})});};
 const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});report.supported=!!adapter;
 const save=async()=>{report.elapsedMilliseconds=performance.now()-started;const r=await fetch(new URL('result',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(report)});if(!r.ok)throw Error(await r.text());return r.json();};
 if(!adapter)return save();
 const info=adapter.info??await adapter.requestAdapterInfo();report.adapter={vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description,isFallbackAdapter:info.isFallbackAdapter??adapter.isFallbackAdapter,backend:info.backend??null,type:info.type??null};
 report.features=[...adapter.features];report.limits={maxStorageBuffersPerShaderStage:adapter.limits.maxStorageBuffersPerShaderStage,maxStorageBufferBindingSize:adapter.limits.maxStorageBufferBindingSize,maxBufferSize:adapter.limits.maxBufferSize};
 const manifest=await(await get('manifest.json')).json(),metadata=await(await get('metadata.json')).json(),arrays={};
 for(const[name,spec]of Object.entries(manifest.arrays)){const bytes=await(await get('arrays/'+name)).arrayBuffer();if(await hash(bytes)!==spec.sha256)throw Error('Pinned array mismatch:'+name);arrays[name]=spec.dtype==='<u4'?new Uint32Array(bytes):new Float32Array(bytes);}
 const wasmBytes=await(await get('core.wasm')).arrayBuffer();if(await hash(wasmBytes)!==metadata.modelHashes.wasm)throw Error('WASM hash changed');
 const wgsl=await(await get('step.wgsl')).text(),arenaBytes=await(await get('arena-inputs.json')).arrayBuffer();if(await hash(arenaBytes)!==metadata.arenaInputSha256)throw Error('Arena inputs changed');const arena=JSON.parse(new TextDecoder().decode(arenaBytes));
 const device=await adapter.requestDevice(),errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));let expectedDestroy=false;device.lost.then(v=>{if(!expectedDestroy)errors.push(`Device lost:${v.reason}:${v.message}`);});device.pushErrorScope('validation');
 let gpu,wasm;
 try{
  gpu=await ExperimentalGPUFlyvis.create(device,manifest,arrays,wgsl);wasm=await SparseVisionModel.create(wasmBytes,manifest,arrays);
  report.setupMilliseconds=gpu.setupMilliseconds;report.csr={maximumDegree:gpu.csr.maximumDegree,offsetsSha256:await hash(gpu.csr.offsets),sourceSha256:await hash(gpu.csr.source),weightSha256:await hash(gpu.csr.weight),originalEdgeSha256:await hash(gpu.csr.originalEdge),stableOriginalOrderVerified:true};
  report.compilationMessages=gpu.compilationMessages;
  await progress('Full-state parity');
  const retain=(label,actual,expected)=>{const comparison={label,...compare(actual,expected)};report.comparisons.push(comparison);report.fullStates.push({label,gpu:encode(actual),wasm:encode(expected),length:actual.length});return comparison.pass;};
  const kinds=['neutral','black','white','on-bar','off-bar','flicker','checker','noise',...arena.map(r=>r.id)];
  for(const kind of kinds){
   const group=gpu.group(1),eye=wasm.eye();let step=0;
   try{
    for(const count of[1,19,80,200]){
     let actual;for(let remaining=count;remaining>0;){const batch=Math.min(20,remaining),a=arena.find(r=>r.id===kind),retina=a?Float32Array.from(a.frames[Math.min(a.frames.length-1,Math.floor(step/20))].retina):input(kind,step,manifest.inputCoordinates);actual=await group.advance([retina],batch);for(let k=0;k<batch;k++)eye.step(retina);step+=batch;remaining-=batch;}
     retain(`${kind}/step-${step}`,actual,eye.checkpoint());
    }
   }finally{group.dispose();eye.dispose();}
  }
  report.parityPass=report.comparisons.every(c=>c.pass);
  await progress('Ownership and continuation');
  const group=gpu.group(2),cpu=[wasm.eye(),wasm.eye()],retinas=[input('on-bar',180,manifest.inputCoordinates),input('off-bar',180,manifest.inputCoordinates)];
  let first=await group.advance(retinas,20);for(const[e,index]of cpu.entries())for(let t=0;t<20;t++)index.step(retinas[e]);
  retain('two-independent-eyes',first,Float32Array.from(cpu.flatMap(e=>Array.from(e.checkpoint()))));
  const checkpoint=await group.checkpoint(),continued=await group.advance(retinas,40);await group.restore(checkpoint);const replay=await group.advance(retinas,40);report.ownership.checkpointExact=equal(continued,replay);
  const snapshot=await group.checkpoint();snapshot.fill(123);report.ownership.returnedSnapshotIndependent=!(await group.checkpoint()).some(v=>v===123);
  await group.restore(checkpoint);const original=retinas.map(a=>a.slice()),pending=group.advance(retinas,20);retinas.forEach(a=>a.fill(0));
  try{await group.advance(original,20);report.ownership.overlapRejected=false;}catch(e){report.ownership.overlapRejected=e.message==='GPU operation pending';}
  const afterMutation=await pending;await group.restore(checkpoint);const expected=await group.advance(original,20);report.ownership.callerInputCopied=equal(afterMutation,expected);
  const other=gpu.group(1),untouched=await other.checkpoint();await group.advance(original,20);report.ownership.otherGroupUntouched=equal(untouched,await other.checkpoint());report.ownership.freshInitialization=equal(untouched,arrays.steadyState);
  const independent=[gpu.group(1),gpu.group(1)];await group.restore(Float32Array.from([...arrays.steadyState,...arrays.steadyState]));const paired=await group.advance(original,20),separate=await Promise.all(independent.map((g,i)=>g.advance([original[i]],20)));report.ownership.pairedMatchesIndependent=equal(paired,Float32Array.from([...separate[0],...separate[1]]));
  group.dispose();other.dispose();independent.forEach(g=>g.dispose());cpu.forEach(e=>e.dispose());try{await group.checkpoint();report.ownership.disposedRejected=false;}catch{report.ownership.disposedRejected=true;}
  report.parityPass=report.comparisons.every(c=>c.pass);report.ownershipPass=Object.values(report.ownership).every(Boolean);
  const validation=await device.popErrorScope();if(validation)errors.push(validation.message);report.errors=errors;
  if(benchmark&&report.parityPass&&report.ownershipPass&&!errors.length&&report.adapter.isFallbackAdapter===false){
   await progress('Submission-to-readback group benchmark');device.pushErrorScope('validation');
   for(const ducks of[1,2,8]){
    const count=ducks*2,g=gpu.group(count),eyes=Array.from({length:count},()=>wasm.eye()),gpuTimes=[],cpuTimes=[];let gpuFinal,cpuFinal;
    for(let iteration=0;iteration<25;iteration++){
     const retinas=Array.from({length:count},(_,eye)=>input('noise',iteration*20,manifest.inputCoordinates,eye));let start=performance.now();gpuFinal=await g.advance(retinas,20);const gpuMs=performance.now()-start;
     start=performance.now();for(let step=0;step<20;step++)for(let eye=0;eye<count;eye++)eyes[eye].step(retinas[eye]);cpuFinal=new Float32Array(count*manifest.nodes);eyes.forEach((e,i)=>cpuFinal.set(e.checkpoint(),i*manifest.nodes));const cpuMs=performance.now()-start;
     if(iteration>=5){gpuTimes.push(gpuMs);cpuTimes.push(cpuMs);}
    }
    const finalComparison={label:`benchmark-${ducks}-ducks-final`,...compare(gpuFinal,cpuFinal)};report.comparisons.push(finalComparison);report.fullStates.push({label:finalComparison.label,gpu:encode(gpuFinal),wasm:encode(cpuFinal),length:gpuFinal.length});
    report.benchmark.push({ducks,eyes:count,stepsPerEye:20,simulatedMilliseconds:40,warmupGroups:5,gpuMilliseconds:distribution(gpuTimes),wasmMilliseconds:distribution(cpuTimes),finalStatePass:finalComparison.pass});g.dispose();eyes.forEach(e=>e.dispose());
   }
   const benchmarkValidation=await device.popErrorScope();if(benchmarkValidation)errors.push(benchmarkValidation.message);
  }
  report.parityPass=report.comparisons.every(c=>c.pass);report.errors=errors;report.hardwareBenchmarkValid=report.parityPass&&report.ownershipPass&&!errors.length&&report.adapter.isFallbackAdapter===false&&report.benchmark.length===3;
 }catch(e){report.failure={message:e.message,stack:e.stack};report.parityPass=false;report.hardwareBenchmarkValid=false;report.errors=errors;}
 finally{gpu?.dispose();wasm?.dispose();expectedDestroy=true;device.destroy();}
 return save();
}
