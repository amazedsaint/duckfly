import { loadLabRuntime } from '../src/lab/lab-runtime.js';
import { Experiment } from '../src/lab/experiment.js';
import { LabArena } from '../src/lab/lab-arena.js';
import { StoppingMeasure } from '../src/lab/loom-benchmarks.js';
import { fetchBytes } from '../src/assets.js';
import { MOTION_CONDITIONS,motionCases,motionScene,configureMotion } from '../../experiments/feedback/motion-suite.js';
const params=new URLSearchParams(location.search),split=params.get('split')??'pilot',seeds=Number(params.get('seeds')??4),conditions=params.get('conditions')?.split(',')??MOTION_CONDITIONS,gfGain=Number(params.get('gain')??6),run=params.get('run')??`motion-${split}-v1`;
const status=document.querySelector('#status'),progress=document.querySelector('#progress'),report=document.querySelector('#report');
async function retain(event,data){const r=await fetch('/__research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run,event,data})});if(!r.ok)throw Error(await r.text());}
try{
 const runtime=await loadLabRuntime(location.origin+'/',message=>status.textContent=message);
 const bytes=await fetchBytes('/assets/scene.json.gz'),arena=new LabArena(document.querySelector('#arena'),JSON.parse(new TextDecoder().decode(bytes)));arena.renderer.setAnimationLoop(null);
 const trials=[],all=motionCases(split,seeds),start=performance.now();
 await retain('start',{format:'duckfly-rotation-study',split,seeds,conditions,run,gfGain});
 for(const c of all)for(const condition of conditions){
  const e=new Experiment(runtime,motionScene(c,condition==='baseline'?6:gfGain));configureMotion(e,c,condition);arena.setScene(e.scene);const trace=[],stopping=new StoppingMeasure();let firstGF=null;
  try{
   for(let tick=0;tick<150;tick++){
    let frames=null;if(e.needsFrames()){arena.updateLab(e.world.state());frames=arena.captureEyes(tick*.02,tick);}
    const state=await e.step(frames),b=state.body.ducks[0],a=state.agents[b.id];stopping.observe(state);
    if(firstGF===null&&a.neural.event==='Giant Fiber · stop reflex')firstGF=state.body.time;
    trace.push({time:state.body.time,position:b.position,fallen:b.fallen,contacts:state.body.collisionCount,speed:b.speed,command:b.command,loom:[a.vision.loomL,a.vision.loomR],firstGF,cameraPose:b.cameraPose,eyes:a.vision.eyes,neural:[a.neural.forward,a.neural.loom]});
   }
   const trial={id:c.id,family:c.family,condition,gfGain:condition==='baseline'?6:gfGain,fallen:trace.some(t=>t.fallen),contacts:trace.at(-1).contacts,firstGF,peakLoom:Math.max(...trace.flatMap(t=>t.loom)),...stopping.result(),trace};
   await retain('trial',trial);const {trace:discard,...compact}=trial;trials.push(compact);
  }finally{e.dispose();}
  status.textContent=`${trials.length} / ${all.length*conditions.length}: ${condition} · ${c.family}`;progress.textContent=JSON.stringify(trials.slice(-3),null,2);arena.renderer.render(arena.scene,arena.camera);
  report.value=JSON.stringify({split,seeds,trials});await new Promise(r=>setTimeout(r,0));
 }
 await retain('complete',{complete:true,elapsedSeconds:(performance.now()-start)/1000});status.textContent='Complete: '+run;
}catch(error){status.textContent='ERROR: '+error.stack;}
