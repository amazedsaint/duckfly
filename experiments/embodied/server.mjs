import base from '../../web/vite.config.js';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {relative,resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),reports=resolve(root,'experiments/embodied/reports');
const paths=['experiments/embodied/candidates.js','experiments/embodied/suite.js','web/tests/embodied-harness.js','web/src/brain.js','web/src/world.js','web/src/bam.js','web/src/lab/experiment.js','web/src/lab/lab-world.js','web/src/lab/lab-arena.js','web/src/lab/vision.js','web/src/lab/visual-system.js','web/src/lab/scene.js','web/src/lab/prop-behavior.js','web/src/vendor/desktop-fly/sim.js','experiments/feedback/candidates.js'];
paths.push('web/tests/embodied-vision.js','shared/vision/retina.js','web/src/lab/body-skills.js');
const entries=['web/tests/embodied-harness.js','web/tests/embodied-vision.js'];
const modules=paths.filter(p=>!entries.includes(p));
const hash=code=>createHash('sha256').update(code).digest('hex');
const guard={name:'embodied-source-receipt',enforce:'pre',resolveId(id){if(id==='virtual:embodied-sources')return '\0embodied-sources';},load(id){if(id==='\0embodied-sources')return modules.map((p,i)=>`import {__embodiedHash as h${i}} from '/@fs/${root+p}';`).join('\n')+`\nexport default entry=>({...entry,${modules.map((p,i)=>`${JSON.stringify(p)}:h${i}`).join(',')}});`;},transform(code,id){if(paths.includes(relative(root,id.split('?')[0])))return `export const __embodiedHash='${hash(code)}';\n${code}`;}};
export default {...base,root:resolve(root,'web'),server:{host:'127.0.0.1',port:5194,strictPort:true,hmr:false,watch:null},plugins:[guard,{name:'embodied-results',configureServer(server){server.middlewares.use('/__embodied',async(req,res)=>{
 try{
  if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:5194')throw Error('Local research origin required');
  let raw='';for await(const b of req){raw+=b;if(raw.length>8000000)throw Error('Report too large');}
  const {run,event,data}=JSON.parse(raw);if(!/^[a-z0-9-]{1,70}$/.test(run))throw Error('Invalid run');
  await mkdir(reports,{recursive:true});const path=resolve(reports,run+'.jsonl');
  if(event==='start'){
   const entry=entries.filter(p=>data.sources?.[p]);if(entry.length!==1)throw Error('One executed entry required');
   const sources={};for(const p of [...modules,...entry]){const code=await readFile(resolve(root,p),'utf8');if(data.sources?.[p]!==hash(code))throw Error('Stale module '+p);sources[p]={sha256:hash(code),code};}
   for(const p of ['shared/assets/Brain/circuit.json','shared/assets/Policies/alpha_walking.onnx'])sources[p]={sha256:hash(await readFile(resolve(root,p)))};
   await writeFile(path,JSON.stringify({event,data:{...data,sourceArchive:sources}})+'\n',{flag:'wx'});
  }else{
   const lines=(await readFile(path,'utf8')).trim().split('\n').map(JSON.parse);if(lines.some(l=>l.event==='complete'))throw Error('Run already complete');
   if(event==='trial'){
    if(lines.some(l=>l.event==='trial'&&l.data.id===data.id&&l.data.condition===data.condition))throw Error('Duplicate trial');
   }else if(event==='complete'){
    const meta=lines[0].data,trials=lines.filter(l=>l.event==='trial').map(l=>l.data);
    if(trials.length!==meta.expectedTrials)throw Error('Incomplete trial count');
    await writeFile(resolve(reports,run+'.json.gz'),gzipSync(JSON.stringify({...meta,...data,trials})),{flag:'wx'});
   }else throw Error('Unknown report event');
   await appendFile(path,JSON.stringify({event,data})+'\n');
  }
  res.end(JSON.stringify({saved:true}));
 }catch(e){res.statusCode=400;res.end(e.message);}
 });}}]};
