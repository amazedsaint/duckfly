import {sourceHashes} from '../../experiments/temporal/source-receipt.js';
import {loadLabRuntime} from '../src/lab/lab-runtime.js';
import {Experiment} from '../src/lab/experiment.js';
import {LabArena} from '../src/lab/lab-arena.js';
import {fetchBytes} from '../src/assets.js';
import {TemporalFeatures} from '../../experiments/temporal/features.js';
import {cases,sceneFor,events,configureDrive,collectionDrive,labelRisk} from '../../experiments/temporal/scenes.js';
const params=new URLSearchParams(location.search),split=params.get('split')??'smoke',seeds=Number(params.get('seeds')??1),run=params.get('run')??`temporal-${split}-v1`;
const status=document.querySelector('#status'),progress=document.querySelector('#progress');
async function retain(event,data){const r=await fetch('/__temporal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run,event,data})});if(!r.ok)throw Error(await r.text());}
try{
 const runtime=await loadLabRuntime(location.origin+'/',message=>status.textContent=message),bytes=await fetchBytes('/assets/scene.json.gz');
 const arena=new LabArena(document.querySelector('#arena'),JSON.parse(new TextDecoder().decode(bytes)));arena.renderer.setAnimationLoop(null);
 const all=cases(split,seeds),started=performance.now();await retain('start',{format:'duckfly-temporal-data',sourceGuardVersion:1,sourceHashes:{...sourceHashes,'web/tests/temporal-harness.js':__researchModuleHash},split,seeds,expectedTrials:all.length});let done=0;
 for(const c of all){const e=new Experiment(runtime,sceneFor(c,true)),features=new TemporalFeatures(),frames=[];configureDrive(e,c,true);arena.setScene(e.scene);
  try{
   for(let tick=0;tick<250;tick++){
    events(e,c,tick);collectionDrive(e,c,tick*.02);let packets=null;
    if(e.needsFrames()){
     const state=e.world.state();arena.updateLab(state);packets=arena.captureEyes(tick*.02,tick);
     const snapshot=features.observe(packets['duck-1'],state.ducks[0]);frames.push({time:tick*.02,snapshot,...labelRisk(e)});
    }
    await e.step(packets);
   }
   await retain('trial',{id:c.id,family:c.family,condition:'collection',case:c,frames});
  }finally{e.dispose();}
  done++;status.textContent=`${done}/${all.length} · ${c.family}`;progress.textContent=JSON.stringify({run,elapsedSeconds:(performance.now()-started)/1000,positive:frames.filter(f=>f.risk).length,frames:frames.length});arena.renderer.render(arena.scene,arena.camera);await new Promise(r=>setTimeout(r,0));
 }
 await retain('complete',{complete:true,elapsedSeconds:(performance.now()-started)/1000});status.textContent=`Complete: ${run}`;
}catch(e){status.textContent='ERROR: '+e.stack;}
