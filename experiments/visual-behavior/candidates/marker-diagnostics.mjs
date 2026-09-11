import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';
const reports=new URL('../reports/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),result=[];
for(const version of[1,2])for(const cohort of['heldout','arena']){
 const prefix=version===1?'candidates-marker':'candidates-marker-v2',name=cohort==='heldout'?`${prefix}-heldout-traces.json.gz`:`${prefix}-arena-screen-traces.json.gz`,bytes=await readFile(new URL(name,reports)),{records}=JSON.parse(gunzipSync(bytes));
 const movies=records.map(r=>{
  const eligible=r.trace.filter(t=>t.time>=.2&&t.truth.safeTracking&&t.truth.visible),observed=r.trace.filter(t=>t.candidate.visible),positions=observed.filter(t=>t.truth.visible&&!t.truth.ambiguous),firstLatch=r.trace.find(t=>['identity-ambiguous','lost','capture-gap'].includes(t.candidate.status));
  const hidden=r.trace.filter(t=>t.truth.hasTarget&&!t.truth.visible),lastHidden=hidden.at(-1)?.time,reacquired=lastHidden===undefined?null:r.trace.find(t=>t.time>lastHidden&&t.candidate.visible);
  return{id:r.id,family:r.family,coverage:eligible.length?eligible.filter(t=>t.candidate.visible).length/eligible.length:null,
   everAcquired:observed.length>0,wrongMeasuredPositions:positions.filter(t=>t.error>3).length,measuredPositions:positions.length,
   firstLatch:firstLatch?{time:firstLatch.time,status:firstLatch.candidate.status}:null,
   lastHidden:lastHidden??null,reacquiredAfterLastHidden:reacquired?.time??null,reacquisitionDelay:reacquired?reacquired.time-lastHidden:null,
   finalStatus:r.trace.at(-1).candidate.status,color:r.parameters?.color??null};
 });
 result.push({version,cohort,inputTraceSha256:sha(bytes),movies,safeMovieCount:movies.filter(m=>m.coverage!==null).length,safeMoviesBelow90Percent:movies.filter(m=>m.coverage!==null&&m.coverage<.9).map(m=>m.id),wrongMeasuredPositions:movies.reduce((n,m)=>n+m.wrongMeasuredPositions,0)});
}
await writeFile(new URL('candidates-marker-diagnostics.json',reports),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.map(({movies,...r})=>({...r,briefOcclusion:movies.filter(m=>m.family==='brief-occlusion')})),null,2));
