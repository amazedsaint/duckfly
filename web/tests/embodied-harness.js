import getSources from 'virtual:embodied-sources';
import {loadLabRuntime} from '../src/lab/lab-runtime.js';
import {Experiment} from '../src/lab/experiment.js';
import {LabArena} from '../src/lab/lab-arena.js';
import {fetchBytes} from '../src/assets.js';
import {CONDITIONS,configureResearch} from '../../experiments/embodied/candidates.js';
import {cases,sceneFor,events,summarize} from '../../experiments/embodied/suite.js';
const params=new URLSearchParams(location.search),run=params.get('run')??'pilot-v1',split=params.get('split')??'pilot',seeds=Number(params.get('seeds')??2),conditions=params.get('conditions')?.split(',')??CONDITIONS;
const bank={'weight-low-turn':{forward:.12,turn:.06},'weight-low-drive':{forward:.08,turn:.12},'weight-high-drive':{forward:.16,turn:.12},'weight-high-turn':{forward:.12,turn:.24}};
const status=document.querySelector('#status'),progress=document.querySelector('#progress');
async function retain(event,data){const r=await fetch('/__embodied',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run,event,data})});if(!r.ok)throw Error(await r.text());}
try{
 const runtime=await loadLabRuntime(location.origin+'/',text=>status.textContent=text),bytes=await fetchBytes('/assets/scene.json.gz');
 const arena=new LabArena(document.querySelector('#arena'),JSON.parse(new TextDecoder().decode(bytes)));arena.renderer.setAnimationLoop(null);
 const all=cases(split,seeds),started=performance.now();let done=0;
 await retain('start',{format:'duckfly-embodied-physical',version:1,run,split,seeds,conditions,bank,sources:getSources({'web/tests/embodied-harness.js':__embodiedHash}),expectedTrials:all.length*conditions.length});
 for(const c of all)for(const condition of conditions){
  const e=new Experiment(runtime,sceneFor(c,condition)),candidate=configureResearch(e,condition,bank[condition]);arena.setScene(e.scene);const trace=[],start=performance.now();
  try{
   for(let tick=0;tick<400;tick++){
    events(e,c,tick);let frames=null;
    if(e.needsFrames()){arena.updateLab(e.world.state());frames=arena.captureEyes(tick*.02,tick);}
    const s=await e.step(frames),b=s.body.ducks[0],a=s.agents[b.id],target=s.body.props.find(p=>p.id==='target-1');
    trace.push({time:s.body.time,error:Math.hypot(target.position[0]-b.position[0],target.position[1]-b.position[1]),visible:!!a.vision?.target.visible,fresh:a.input.fresh,fallen:b.fallen,tilt:b.tilt,contacts:s.body.collisionCount,command:b.command,speed:b.speed,position:b.position,head:a.input.head[2],neural:[a.neural.forward,a.neural.left,a.neural.right],diagnostics:candidate.diagnostics});
    if(tick%100===0)await new Promise(r=>setTimeout(r,0));
   }
   const trial=summarize(c,condition,trace,performance.now()-start);await retain('trial',trial);done++;
   const {trace:_,...compact}=trial;status.textContent=`${done}/${all.length*conditions.length} · ${c.family} · ${condition}`;progress.textContent=JSON.stringify(compact,null,2);arena.renderer.render(arena.scene,arena.camera);
  }finally{e.dispose();}
  await new Promise(r=>setTimeout(r,0));
 }
 await retain('complete',{complete:true,elapsedSeconds:(performance.now()-started)/1000});status.textContent='Complete: '+run;
}catch(e){status.textContent='ERROR: '+e.stack;}
