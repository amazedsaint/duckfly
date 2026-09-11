import{readFile,writeFile}from'node:fs/promises';import{gunzipSync,gzipSync}from'node:zlib';import{createHash}from'node:crypto';
import{ClearMarkerTracker}from'./marker-tracker-v2.mjs';import{VisionEncoder}from'../../../web/src/lab/vision.js';
const reports=new URL('../reports/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),bytes=await readFile(new URL('candidates-arena-marker-v2.json.gz',reports)),data=JSON.parse(gunzipSync(bytes));
const frozen=JSON.parse(await readFile(new URL('candidates-marker-v2-frozen.json',reports),'utf8'));if(sha(await readFile(new URL('marker-tracker-v2.mjs',import.meta.url)))!==frozen.sources['marker-tracker-v2.mjs'])throw Error('Frozen tracker changed');
const records=[];
for(const movie of data.records){
 const tracker=new ClearMarkerTracker(),baseline=new VisionEncoder(),trace=[];
 for(const[frameId,f]of movie.frames.entries()){
  const pixels=new Uint8Array(Buffer.from(f.rgba,'base64')),r=tracker.step({pixels,captureTime:f.time,frameId,sourceId:movie.id}),b=baseline.encode(pixels,96,64,f.time).target;
  const error=center=>center&&f.truth.visible?Math.hypot(center[0]-f.truth.center[0],center[1]-f.truth.center[1]):null;
  trace.push({time:f.time,truth:f.truth,candidate:r,baseline:b,error:error(r.center),baselineError:error(b.center)});
 }
 const eligible=trace.filter(t=>t.time>=.2&&t.truth.safeTracking&&t.truth.visible),identified=eligible.filter(t=>t.candidate.visible),ambiguous=trace.filter(t=>t.truth.ambiguous);
 records.push({id:movie.id,family:movie.family,trace,eligibleFrames:eligible.length,visibleFrames:identified.length,wrongFrames:identified.filter(t=>t.error>3).length,
  baselineWrongFrames:eligible.filter(t=>t.baseline.visible&&t.baselineError>3).length,ambiguousFrames:ambiguous.length,confidentAmbiguousFrames:ambiguous.filter(t=>t.candidate.visible).length,
  falseTargetFrames:trace.filter(t=>!t.truth.hasTarget&&t.candidate.visible).length,baselineFalseTargetFrames:trace.filter(t=>!t.truth.hasTarget&&t.baseline.visible).length});
}
const groups={};for(const r of records){const g=groups[r.family]??={movies:0,eligibleFrames:0,visibleFrames:0,wrongFrames:0,baselineWrongFrames:0,ambiguousFrames:0,confidentAmbiguousFrames:0,falseTargetFrames:0,baselineFalseTargetFrames:0};g.movies++;for(const k of Object.keys(g).filter(k=>k!=='movies'))g[k]+=r[k];}
for(const g of Object.values(groups)){g.coverage=g.eligibleFrames?g.visibleFrames/g.eligibleFrames:null;g.wrongRate=g.visibleFrames?g.wrongFrames/g.visibleFrames:null;}
const safe=Object.values(groups).filter(g=>g.eligibleFrames),gates={coverage:records.filter(r=>r.eligibleFrames).every(r=>r.visibleFrames/r.eligibleFrames>=.9),precision:safe.every(g=>g.wrongRate!==null&&g.wrongRate<=.01),ambiguityAbstention:records.every(r=>r.confidentAmbiguousFrames===0),noTargetRejection:records.every(r=>r.falseTargetFrames===0)};gates.pass=Object.values(gates).every(Boolean);
const traceBytes=gzipSync(JSON.stringify({records}),{level:9}),summary={sourceArtifactSha256:sha(bytes),trackerSha256:frozen.sources['marker-tracker-v2.mjs'],screenSha256:sha(await readFile(new URL('marker-arena-screen-v2.mjs',import.meta.url))),movies:records.length,groups,gates,traceArtifactSha256:sha(traceBytes),productionPromotion:false,biologicalCircuit:false,bodyUsefulness:false};
await writeFile(new URL('candidates-marker-v2-arena-screen-traces.json.gz',reports),traceBytes);await writeFile(new URL('candidates-marker-v2-arena-screen-summary.json',reports),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
