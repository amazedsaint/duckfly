import { loadLabRuntime } from '../src/lab/lab-runtime.js';
import { Experiment } from '../src/lab/experiment.js';
import { LabArena } from '../src/lab/lab-arena.js';
import { fetchBytes } from '../src/assets.js';
import { CONDITIONS,configureResearch } from '../../experiments/feedback/candidates.js';
import { cases,sceneFor,sceneEvents,trialMetrics } from '../../experiments/feedback/suite.js';
const params=new URLSearchParams(location.search),split=params.get('split')??'pilot',seeds=Number(params.get('seeds')??4),conditions=params.get('conditions')?.split(',')??CONDITIONS;
const run=params.get('run')??`${split}-v1`;
async function retain(event,data){const response=await fetch('/__research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run,event,data})});if(!response.ok)throw Error(await response.text());return response.json();}
const status=document.querySelector('#status'),progress=document.querySelector('#progress'),report=document.querySelector('#report');
try{
 const runtime=await loadLabRuntime(location.origin+'/',message=>status.textContent=message);
 const bytes=await fetchBytes('/assets/scene.json.gz'),arena=new LabArena(document.querySelector('#arena'),JSON.parse(new TextDecoder().decode(bytes)));
 arena.renderer.setAnimationLoop(null);
 const trials=[],all=cases(split,seeds),started=performance.now();
 const retained=await retain(params.has('resume')?'resume':'start',{format:'duckfly-feedback-study',split,seeds,conditions,run});trials.push(...retained.trials);
 const completed=new Set(trials.map(t=>t.id+'/'+t.condition));
 for(const c of all)for(const condition of conditions){
  if(completed.has(c.id+'/'+condition))continue;
  const e=new Experiment(runtime,sceneFor(c,condition));configureResearch(e,condition);arena.setScene(e.scene);const trace=[],start=performance.now();
  try{
   for(let tick=0;tick<300;tick++){
    sceneEvents(e,c,tick);let frames=null;
    if(e.needsFrames()){arena.updateLab(e.world.state());frames=arena.captureEyes(tick*.02,tick);}
    const state=await e.step(frames),b=state.body.ducks[0],a=state.agents[b.id],target=state.body.props.find(p=>p.id==='target-1');
    const desired=Math.atan2(target.position[1]-b.position[1],target.position[0]-b.position[0]);
    trace.push({time:state.body.time,error:Math.hypot(target.position[0]-b.position[0],target.position[1]-b.position[1]),visible:!!a.vision?.target.visible,headingError:Math.atan2(Math.sin(desired-b.heading),Math.cos(desired-b.heading)),fallen:b.fallen,contacts:state.body.collisionCount,distance:b.distance,command:b.command,head:a.input.head[2],fresh:a.input.fresh,gate:a.input.gate,position:b.position,bodyHeading:b.heading,cameraPose:b.cameraPose,bearing:a.vision?.target.bearing,neural:[a.neural.forward,a.neural.left,a.neural.right],research:a.input.research});
   }
   const trial=trialMetrics(c,condition,trace,performance.now()-start);
   await retain('trial',trial);const {trace:discard,...compact}=trial;trials.push(compact);
  }finally{e.dispose();}
  status.textContent=`${trials.length} / ${all.length*conditions.length}: ${condition} · ${c.family}`;
  progress.textContent=JSON.stringify({elapsedSeconds:(performance.now()-started)/1000,latest:trials.slice(-conditions.length).map(({trace,...t})=>t)},null,2);
  arena.renderer.render(arena.scene,arena.camera);
  report.value=JSON.stringify({format:'duckfly-feedback-study',split,seeds,conditions,trials,complete:trials.length===all.length*conditions.length,elapsedSeconds:(performance.now()-started)/1000});
  await new Promise(r=>setTimeout(r,0));
 }
 await retain('complete',{complete:true,elapsedSeconds:(performance.now()-started)/1000});
 status.textContent='Complete: '+run;
}catch(error){status.textContent='ERROR: '+error.stack;}
