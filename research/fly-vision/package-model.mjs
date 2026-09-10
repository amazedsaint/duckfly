import fs from 'node:fs';
const dir=new URL('./artifacts/',import.meta.url),out=new URL('../../shared/vision/models/flyvis-000/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',dir))),parity=JSON.parse(fs.readFileSync(new URL('parity.json',dir)));
if(!parity.passed||parity.maxAbsolute>parity.atol)throw Error('Numerical parity gate failed');
manifest.validation.numericalParity=true;manifest.validation.bodyBridge=false;
for(const key of Object.keys(manifest.arrays))if(key.startsWith('fixture'))delete manifest.arrays[key];
fs.mkdirSync(out,{recursive:true});
for(const meta of Object.values(manifest.arrays))fs.copyFileSync(new URL(meta.file,dir),new URL(meta.file,out));
fs.writeFileSync(new URL('manifest.json',out),JSON.stringify(manifest));fs.writeFileSync(new URL('parity.json',out),JSON.stringify(parity,null,2));
// The larger oracle trace remains a research artifact; production only needs the model.

// Retain a compact subset of full-state oracle fixtures for offline CI.
const {gunzipSync,gzipSync}=await import('node:zlib');
const fixtures=new URL('../../shared/vision/fixtures/',import.meta.url);fs.mkdirSync(fixtures,{recursive:true});
const unpack=name=>gunzipSync(fs.readFileSync(new URL(name+'.bin.gz',dir)));
const input=unpack('fixtureInput'),rawTicks=unpack('fixtureTicks'),states=unpack('fixtureState'),ticks=new Uint32Array(new Uint8Array(rawTicks).buffer);
const oracle={sourceCommit:manifest.sourceCommit,checkpointSha256:manifest.checkpointSha256,dt:manifest.dt,steps:input.byteLength/(721*4),atol:parity.atol,rtol:parity.rtol,input:'oracle-input.bin.gz',states:{}};
fs.writeFileSync(new URL(oracle.input,fixtures),gzipSync(input));
for(const tick of [0,119,499,999]){const i=ticks.indexOf(tick);if(i<0)throw Error('Missing long oracle state');const data=states.subarray(i*manifest.nodes*4,(i+1)*manifest.nodes*4),file=`oracle-state-${tick}.bin.gz`;
 fs.writeFileSync(new URL(file,fixtures),gzipSync(data));oracle.states[tick]={file};}
fs.writeFileSync(new URL('oracle.json',fixtures),JSON.stringify(oracle,null,2));
