import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{gzipSync}from'node:zlib';
import{ClearMarkerTracker,MARKER_SETTINGS}from'./marker-tracker.mjs';
import{markerCases,markerFrame,markerTimes}from'./marker-movies.mjs';
import{VisionEncoder}from'../../../web/src/lab/vision.js';
const split=process.argv[2]??'calibration';if(!['calibration','heldout'].includes(split))throw Error('Unknown split');
const reports=new URL('../reports/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),sources={};
for(const f of ['marker-tracker.mjs','marker-movies.mjs','marker-study.mjs','MARKER-PLAN.md'])sources[f]=sha(await readFile(new URL(f,import.meta.url)));
sources['web/src/lab/vision.js']=sha(await readFile(new URL('../../../web/src/lab/vision.js',import.meta.url)));
if(split==='heldout'){const frozen=JSON.parse(await readFile(new URL('candidates-marker-frozen.json',reports),'utf8'));if(JSON.stringify(frozen.sources)!==JSON.stringify(sources))throw Error('Frozen source mismatch');}
const records=[],movieBytes=[];let offset=0;
for(const c of markerCases(split,split==='calibration'?6:24)){
 const tracker=new ClearMarkerTracker(),baseline=new VisionEncoder(),trace=[],bytes=[];
 for(const[frameId,time]of markerTimes(c).entries()){
  const{pixels,truth}=markerFrame(c,time),r=tracker.step({pixels,captureTime:time,frameId,sourceId:c.id}),b=baseline.encode(pixels,96,64,time).target;
  const error=center=>truth.visible&&center?Math.hypot(center[0]-truth.center[0],center[1]-truth.center[1]):null;
  trace.push({time,truth,candidate:r,baseline:b,error:error(r.center),baselineError:error(b.center)});bytes.push(Buffer.from(pixels));
 }
 const raw=Buffer.concat(bytes),eligible=trace.filter(t=>t.time>=.2&&t.truth.safeTracking&&t.truth.visible),identified=eligible.filter(t=>t.candidate.visible),ambiguous=trace.filter(t=>t.truth.ambiguous);
 const record={id:c.id,family:c.family,parameters:c,byteOffset:offset,byteLength:raw.length,inputSha256:sha(raw),trace,
  eligibleFrames:eligible.length,visibleFrames:identified.length,wrongFrames:identified.filter(t=>t.error>3).length,
  baselineWrongFrames:eligible.filter(t=>t.baseline.visible&&t.baselineError>3).length,
  ambiguousFrames:ambiguous.length,confidentAmbiguousFrames:ambiguous.filter(t=>t.candidate.visible).length,
  falseTargetFrames:trace.filter(t=>!t.truth.hasTarget&&t.candidate.visible).length,
  baselineFalseTargetFrames:trace.filter(t=>!t.truth.hasTarget&&t.baseline.visible).length};
 records.push(record);movieBytes.push(raw);offset+=raw.length;
 console.log(record.id,record.visibleFrames,record.eligibleFrames,record.wrongFrames,record.confidentAmbiguousFrames,record.falseTargetFrames);
}
const groups={};for(const r of records){const g=groups[r.family]??={movies:0,eligibleFrames:0,visibleFrames:0,wrongFrames:0,baselineWrongFrames:0,ambiguousFrames:0,confidentAmbiguousFrames:0,falseTargetFrames:0,baselineFalseTargetFrames:0};g.movies++;for(const k of Object.keys(g).filter(k=>k!=='movies'))g[k]+=r[k];}
for(const g of Object.values(groups)){g.coverage=g.eligibleFrames?g.visibleFrames/g.eligibleFrames:null;g.wrongRate=g.visibleFrames?g.wrongFrames/g.visibleFrames:null;}
const safe=Object.values(groups).filter(g=>g.eligibleFrames),gates={coverage:safe.every(g=>g.coverage>=.9),precision:safe.every(g=>g.wrongRate!==null&&g.wrongRate<=.01),ambiguityAbstention:records.every(r=>r.confidentAmbiguousFrames===0),noTargetRejection:records.every(r=>r.falseTargetFrames===0)};
gates.pass=Object.values(gates).every(Boolean);
const compressed=gzipSync(Buffer.concat(movieBytes),{level:9}),traces=gzipSync(JSON.stringify({records}),{level:9});
const summary={split,sources,settings:MARKER_SETTINGS,movies:records.length,groups,gates,movieArtifactSha256:sha(compressed),traceArtifactSha256:sha(traces),productionPromotion:false,biologicalCircuit:false,bodyUsefulness:false};
await writeFile(new URL(`candidates-marker-${split}-movies.rgba.gz`,reports),compressed);await writeFile(new URL(`candidates-marker-${split}-traces.json.gz`,reports),traces);
await writeFile(new URL(`candidates-marker-${split}-summary.json`,reports),JSON.stringify(summary,null,2)+'\n');
if(split==='calibration')await writeFile(new URL('candidates-marker-frozen.json',reports),JSON.stringify({sources,settings:MARKER_SETTINGS},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
