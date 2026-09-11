import base from '../../../web/vite.config.js';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {relative,resolve} from 'node:path';
import {ASSETS} from './provenance.js';
import {scoreDecoder,LIMITS,neuralFlowFeature} from './decoders.js';
const root=fileURLToPath(new URL('../../../',import.meta.url)),folder='experiments/visual-behavior/motion-room/',reports=resolve(root,folder,'reports');
const modules=[...['decoders.js','stimulus.js','retinal-model.js','provenance.js'].map(name=>folder+name),
  'web/src/brain.js','web/src/world.js','web/src/bam.js','web/src/assets.js','web/src/arena.js',
  ...['lab-runtime.js','flyvis-runtime.js','experiment.js','lab-world.js','lab-arena.js','vision.js','visual-system.js','scene.js','prop-behavior.js','guided-labs.js','body-skills.js','brain-mapping.js'].map(name=>'web/src/lab/'+name),
  'web/src/vendor/desktop-fly/sim.js',...['frame.js','retina.js','motion.js','sparse-runtime.js','readouts/spatial.js','readouts/neural-map-flow.js','temporal/loop.js','temporal/features.js','temporal/geometry.js','temporal/decoder.js','temporal/feedback.js'].map(name=>'shared/vision/'+name)];
const entry=folder+'harness.js',paths=[...modules,entry],hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourcePlugin={name:'motion-room-consumed-sources',enforce:'pre',resolveId(id){if(id==='virtual:motion-room-sources')return '\0motion-room-sources';},load(id){if(id==='\0motion-room-sources')return modules.map((p,i)=>`import {__motionRoomHash as h${i}} from '/@fs/${root+p}';`).join('\n')+`\nexport default entry=>({...entry,${modules.map((p,i)=>`${JSON.stringify(p)}:h${i}`).join(',')}});`;},transform(code,id){if(paths.includes(relative(root,id.split('?')[0])))return `export const __motionRoomHash='${hash(code)}';\n${code}`;}};
const validName=name=>typeof name==='string'&&/^[a-z0-9-]{1,70}$/.test(name);
async function verify(header){
  const sourceArchive={};
  for(const p of paths){const code=await readFile(resolve(root,p),'utf8');if(header.sources?.[p]!==hash(code))throw Error('Stale or missing executed source '+p);sourceArchive[p]={sha256:hash(code),code};}
  for(const a of ASSETS){const raw=await readFile(resolve(root,a.path)),bytes=a.gzip?gunzipSync(raw):raw;if(header.assets?.[a.path]!==hash(bytes))throw Error('Served asset differs from pinned checkout '+a.path);sourceArchive[a.path]={sha256:hash(bytes)};}
  for(const p of [folder+'PROTOCOL.md',folder+'server.mjs','shared/vision/models/flyvis-000/manifest.json']){const code=await readFile(resolve(root,p),'utf8');sourceArchive[p]={sha256:hash(code),code};}
  return sourceArchive;
}
async function loadCalibration(name){
  if(!validName(name))throw Error('Invalid calibration name');const file=JSON.parse(gunzipSync(await readFile(resolve(reports,name+'.json.gz'))));
  if(file.study!=='calibration'||!file.complete||!file.calibration)throw Error('Calibration was not completed');return file.calibration;
}
export default {...base,root:resolve(root,folder),cacheDir:'/tmp/duckfly-motion-room-vite',publicDir:resolve(root,'web/public'),resolve:{alias:[{find:/^three$/,replacement:resolve(root,'web/node_modules/three/build/three.module.js')},{find:/^three\/addons\//,replacement:resolve(root,'web/node_modules/three/examples/jsm')+'/'},{find:/^three\//,replacement:resolve(root,'web/node_modules/three')+'/'}]},server:{host:'127.0.0.1',port:5198,strictPort:true,hmr:false,watch:null,fs:{allow:[root]}},plugins:[sourcePlugin,{name:'motion-room-evidence',configureServer(server){
  server.middlewares.use('/__motion_room_calibration',async(req,res)=>{try{if(req.method!=='GET')throw Error('GET required');const name=new URL(req.url,'http://127.0.0.1:5198').searchParams.get('run');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await loadCalibration(name)));}catch(e){res.statusCode=400;res.end(e.message);}});
  server.middlewares.use('/__motion_room',async(req,res)=>{
    try{
      if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:5198')throw Error('Local research origin required');
      let raw='';for await(const part of req){raw+=part;if(raw.length>16000000)throw Error('Trial too large');}
      const {run,event,data}=JSON.parse(raw);if(!validName(run))throw Error('Invalid run name');await mkdir(reports,{recursive:true});const path=resolve(reports,run+'.jsonl');
      if(event==='start'){
        if(!['calibration','physical'].includes(data.study)||!Number.isInteger(data.expectedTrials)||data.expectedTrials<1)throw Error('Invalid study plan');
        const sourceArchive=await verify(data);
        if(data.study==='physical'){const stored=await loadCalibration(data.calibration?.run);if(!stored.admitted||JSON.stringify(stored)!==JSON.stringify(data.calibration)||JSON.stringify(stored.metadata)!==JSON.stringify(data.metadata))throw Error('Qualified immutable calibration required');}
        await writeFile(path,JSON.stringify({event,data:{...data,sourceArchive,startedAt:new Date().toISOString()}})+'\n',{flag:'wx'});
      }else{
        const lines=(await readFile(path,'utf8')).trim().split('\n').map(JSON.parse),header=lines[0].data;
        if(lines.some(row=>row.event==='complete'))throw Error('Run already complete');await verify(header);
        const trials=lines.filter(row=>row.event==='trial').map(row=>row.data);
        if(event==='trial'){
          if(trials.some(t=>t.id===data.id&&t.condition===data.condition))throw Error('Duplicate trial');
          const planned=header.plan.some(c=>c.id===data.id);if(!planned)throw Error('Trial outside declared plan');
          await appendFile(path,JSON.stringify({event,data})+'\n');
        }else if(event==='complete'){
          if(trials.length!==header.expectedTrials)throw Error('Incomplete trial count');
          if(header.study==='calibration'){
            const heldout=trials.filter(t=>t.condition==='heldout').flatMap(t=>t.rows),c=data.calibration;
            if(!c||JSON.stringify(c.limits)!==JSON.stringify(LIMITS))throw Error('Admission limits changed');
            if(c.version===2){
              const gradients=trials.filter(t=>t.condition==='train').flatMap(t=>t.rows).filter(r=>r.time>=.6&&r.rate!==0).flatMap(r=>r.neuralFlows.map(f=>f.gradientRms)).filter(Number.isFinite).sort((a,b)=>a-b);
              if(c.minimumGradient!==gradients[Math.floor((gradients.length-1)*.1)]*.25)throw Error('Confidence floor differs from training-only rule');
              for(const row of heldout)row.flyvis=neuralFlowFeature(row,c.minimumGradient);
            }
            for(const key of ['flyvis','conventional'])if(JSON.stringify(scoreDecoder(c.decoders[key],heldout,key))!==JSON.stringify(c.scores[key]))throw Error('Calibration scores differ from retained samples');
            if(c.admitted!==Object.values(c.scores).every(s=>s.passed))throw Error('Invalid admission decision');
          }
          const complete={...header,...data,trials,finishedAt:new Date().toISOString()};await writeFile(resolve(reports,run+'.json.gz'),gzipSync(JSON.stringify(complete)),{flag:'wx'});await appendFile(path,JSON.stringify({event,data})+'\n');
        }else throw Error('Unknown report event');
      }
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true}));
    }catch(error){res.statusCode=400;res.end(error.message);}
  });
}}]};
