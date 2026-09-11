import{readFile,writeFile}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const reports=new URL('../reports/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),receipts=[],ids=new Set(),movieHashes=new Set();
for(const version of[1,2]){
 const suffix=version===1?'':'-v2',prefix=`candidates-marker${suffix}`,{ClearMarkerTracker}=await import(`./marker-tracker${suffix}.mjs`);
 for(const split of['calibration','heldout']){
  const summary=JSON.parse(await readFile(new URL(`${prefix}-${split}-summary.json`,reports),'utf8')),
    encoded=await readFile(new URL(`${prefix}-${split}-movies.rgba.gz`,reports)),traces=await readFile(new URL(`${prefix}-${split}-traces.json.gz`,reports));
  assert.equal(sha(encoded),summary.movieArtifactSha256);assert.equal(sha(traces),summary.traceArtifactSha256);
  const raw=gunzipSync(encoded),{records}=JSON.parse(gunzipSync(traces));let frames=0;
  for(const r of records){
   assert(!ids.has(r.id));ids.add(r.id);assert(!movieHashes.has(r.inputSha256));movieHashes.add(r.inputSha256);
   const bytes=raw.subarray(r.byteOffset,r.byteOffset+r.byteLength);assert.equal(sha(bytes),r.inputSha256);assert.equal(bytes.length,r.trace.length*96*64*4);
   const tracker=new ClearMarkerTracker();
   for(const[i,f]of r.trace.entries()){
    const pixels=new Uint8Array(bytes.subarray(i*96*64*4,(i+1)*96*64*4));
    assert.deepEqual(tracker.step({pixels,captureTime:f.time,frameId:i,sourceId:r.id}),f.candidate);frames++;
   }
  }
  receipts.push({version,split,movies:records.length,frames,moviesSha256:sha(encoded),tracesSha256:sha(traces),exactReplay:true});
 }
}
await writeFile(new URL('candidates-marker-evidence-verification.json',reports),JSON.stringify({receipts,uniqueMovieIds:ids.size,uniqueMovieHashes:movieHashes.size},null,2)+'\n');console.log(JSON.stringify(receipts,null,2));
