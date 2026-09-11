import{createServer}from'node:http';import{readFile,writeFile}from'node:fs/promises';import{gzipSync,gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
import{loadPackagedFlyvis}from'../load-model.mjs';import{sampleRetina}from'../../../shared/vision/retina.js';import{EYE_CALIBRATION}from'../../../shared/vision/frame.js';
const sha=b=>createHash('sha256').update(b).digest('hex'),loaded=await loadPackagedFlyvis(),files=new Map(),sourceHashes={};
for(const name of['browser-run.mjs','gpu-model.mjs','csr.mjs','step.wgsl','PLAN.md','server.mjs']){const bytes=await readFile(new URL(name,import.meta.url));files.set('/'+name,bytes);sourceHashes[name]=sha(bytes);}
const runtime=await readFile(new URL('../../../shared/vision/sparse-runtime.js',import.meta.url));files.set('/sparse-runtime.js',runtime);files.set('/core.wasm',loaded.wasmBytes);files.set('/manifest.json',Buffer.from(JSON.stringify(loaded.manifest)));
for(const[name,array]of Object.entries(loaded.arrays))files.set('/arrays/'+name,Buffer.from(array.buffer,array.byteOffset,array.byteLength));
const arenaBytes=await readFile(new URL('../reports/candidates-arena-dd-v1.json.gz',import.meta.url)),arena=JSON.parse(gunzipSync(arenaBytes));
const arenaInputs=arena.records.filter(r=>['target-pass','stationary-flicker'].includes(r.family)&&r.index===3).map(r=>({id:r.id,family:r.family,frames:r.frames.map(f=>({time:f.time,retina:Array.from(sampleRetina(new Uint8Array(Buffer.from(f.rgba,'base64')),EYE_CALIBRATION))}))}));
files.set('/arena-inputs.json',Buffer.from(JSON.stringify(arenaInputs)));
const metadata={modelHashes:loaded.hashes,sourceHashes,arenaArtifactSha256:sha(arenaBytes),arenaInputSha256:sha(files.get('/arena-inputs.json')),hostCPU:execFileSync('sysctl',['-n','machdep.cpu.brand_string'],{encoding:'utf8'}).trim()};
files.set('/metadata.json',Buffer.from(JSON.stringify(metadata)));loaded.model.dispose();
const server=createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5182');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 try{
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.method==='GET'&&files.has(req.url)){res.setHeader('Content-Type',req.url.endsWith('.mjs')||req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.json')?'application/json':'application/octet-stream');res.end(files.get(req.url));return;}
  if(req.method!=='POST'||!['/result','/progress'].includes(req.url)){res.writeHead(404);res.end();return;}
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>85_000_000)throw Error('Result too large');chunks.push(chunk);}
  const record=JSON.parse(Buffer.concat(chunks));
  if(req.url==='/progress'){console.log(JSON.stringify(record));res.end('ok');return;}
  if(record.experiment!=='full-flyvis-webgpu-v1')throw Error('Unexpected experiment');
  const bytes=gzipSync(JSON.stringify({...record,serverMetadata:metadata}),{level:9}),summary={...record,serverMetadata:metadata};delete summary.fullStates;
  const suffix=record.stage==='parity'?'-parity':'';
  summary.fullEvidenceSha256=sha(bytes);await writeFile(new URL(`result${suffix}-v1.json.gz`,import.meta.url),bytes);await writeFile(new URL(`summary${suffix}-v1.json`,import.meta.url),JSON.stringify(summary,null,2)+'\n');
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true,supported:record.supported,parityPass:record.parityPass,ownershipPass:record.ownershipPass,benchmark:record.benchmark,fullEvidenceSha256:sha(bytes)}));
 }catch(e){res.writeHead(400);res.end(e.message);}
});server.listen(0,'127.0.0.1',()=>console.log(`Flyvis GPU feasibility http://127.0.0.1:${server.address().port}`));
