import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const pub=resolve(root,'web/public');
await mkdir(`${pub}/assets`,{recursive:true});await mkdir(`${pub}/runtime`,{recursive:true});
for(const item of ['Simulation','Brain','Policies']) await cp(`${root}/shared/assets/${item}`,`${pub}/assets/${item}`,{recursive:true,filter:source=>!source.endsWith('/microduck.mjb.gz')});
// The original fixed model remains a reference fixture in shared/, while the
// editable lab downloads its smaller physical template.
await rm(`${pub}/assets/Simulation/microduck.mjb.gz`,{force:true});
await writeFile(`${pub}/assets/scene.json.gz`,gzipSync(await readFile(`${root}/shared/assets/scene.json`)));
for(const name of ['mujoco.js','mujoco.wasm']) await cp(`${root}/web/node_modules/@mujoco/mujoco/${name}`,`${pub}/runtime/${name}`);
for(const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']) await cp(`${root}/web/node_modules/onnxruntime-web/dist/${name}`,`${pub}/runtime/${name}`);
await cp(`${root}/THIRD_PARTY_NOTICES.md`,`${pub}/assets/THIRD_PARTY_NOTICES.md`);
await cp(`${root}/LICENSE`,`${pub}/assets/LICENSE`);
await cp(`${root}/shared/licenses`,`${pub}/assets/licenses`,{recursive:true});
console.log('Prepared shared assets and local WASM runtimes.');
