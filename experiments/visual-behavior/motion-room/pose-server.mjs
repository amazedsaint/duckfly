import base from '../../../web/vite.config.js';
import fs from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {relative,resolve} from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url)),folder=resolve(root,'experiments/visual-behavior/motion-room'),reports=resolve(folder,'reports');
const originalPath=resolve(reports,'motion-physical-v2-pilot.json.gz'),originalBytes=fs.readFileSync(originalPath),original=JSON.parse(gunzipSync(originalBytes));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),consumed={};
const trials=original.trials.filter(t=>t.condition==='none-direct').map(t=>({id:t.id,condition:t.condition,parameters:t.parameters,initial:t.initial,trace:t.trace.map(r=>({time:r.time,bodyTime:r.bodyTime,torque:r.torque,panoramaAngle:r.panoramaAngle,body:r.body,frame:r.frame?{retina:r.frame.retina,captureTime:r.frame.captureTime,frameId:r.frame.frameId}:null}))}));
const plan={sourceSha256:hash(originalBytes),sourcePath:relative(root,originalPath),interpretation:'Reconstructed from archived runtime and recorded applied commands. Not original camera pose measurements.',assets:original.assets,trials};
const valid=s=>typeof s==='string'&&/^[a-z0-9-]{1,70}$/.test(s);
const snapshot={name:'archived-physical-runtime',enforce:'pre',load(id){const p=relative(root,id.split('?')[0]);if(original.sourceArchive[p]?.code&&p!=='experiments/visual-behavior/motion-room/server.mjs')return original.sourceArchive[p].code;},transform(code,id){const p=relative(root,id.split('?')[0]);if(!p.includes('node_modules')&&/\.m?js$/.test(p)&&!p.startsWith('..'))consumed[p]={sha256:hash(code),code,archived:original.sourceArchive[p]?.sha256===hash(code)};}};
export default {...base,root:folder,publicDir:resolve(root,'web/public'),cacheDir:'/tmp/duckfly-motion-pose-vite',optimizeDeps:{entries:['pose-replay.html']},resolve:{alias:[{find:/^three$/,replacement:resolve(root,'web/node_modules/three/build/three.module.js')},{find:/^three\/addons\//,replacement:resolve(root,'web/node_modules/three/examples/jsm')+'/'},{find:/^three\//,replacement:resolve(root,'web/node_modules/three')+'/'}]},server:{host:'127.0.0.1',port:5199,strictPort:true,hmr:false,watch:null,fs:{allow:[root]}},plugins:[snapshot,{name:'pose-replay-evidence',configureServer(server){
  server.middlewares.use('/__pose_original',(req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(plan));});
  server.middlewares.use('/__pose_retain',async(req,res)=>{try{
    if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:5199')throw Error('Local replay origin required');
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4000000)throw Error('Record too large');}
    const {run,event,data}=JSON.parse(raw);if(!valid(run))throw Error('Invalid run name');const path=resolve(reports,run+'.jsonl');
    if(event==='start'){
      for(const p of ['web/src/world.js','web/src/lab/lab-world.js','web/src/lab/experiment.js','web/src/lab/lab-arena.js'])if(!consumed[p]?.archived)throw Error('Original archived runtime not consumed: '+p);
      for(const [p,expected] of Object.entries(original.assets))if(data.assets?.[p]!==expected)throw Error('Body asset identity differs: '+p);
      fs.writeFileSync(path,JSON.stringify({event,data:{...data,original:plan.sourceSha256,sourcePath:plan.sourcePath,sourceArchive:consumed,startedAt:new Date().toISOString(),interpretation:plan.interpretation}})+'\n',{flag:'wx'});
    }else{
      const events=fs.readFileSync(path,'utf8').trim().split('\n').map(JSON.parse);if(events.some(r=>r.event==='complete'))throw Error('Already complete');
      const accepted=events.filter(r=>r.event==='trial').map(r=>r.data);
      if(event==='trial'){
        if(!trials.some(t=>t.id===data.id)||accepted.some(t=>t.id===data.id))throw Error('Invalid/repeated trajectory');
        if(!data.accepted||data.frames.length!==100)throw Error('Rejecting failed/incomplete pose oracle');
        fs.appendFileSync(path,JSON.stringify({event,data})+'\n');
      }else if(event==='complete'){
        if(accepted.length!==6)throw Error('Incomplete pose reconstruction');
        const result={...events[0].data,...data,trials:accepted,finishedAt:new Date().toISOString()};
        fs.writeFileSync(resolve(reports,run+'.json.gz'),gzipSync(JSON.stringify(result)),{flag:'wx'});fs.appendFileSync(path,JSON.stringify({event,data})+'\n');
      }else if(event==='failure')fs.appendFileSync(path,JSON.stringify({event,data})+'\n');else throw Error('Unknown event');
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true}));
  }catch(error){res.statusCode=400;res.end(error.message);}});
}}]};
