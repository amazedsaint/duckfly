import getSources from 'virtual:embodied-sources';
import {loadLabRuntime} from '../src/lab/lab-runtime.js';
import {Experiment} from '../src/lab/experiment.js';
import {LabArena} from '../src/lab/lab-arena.js';
import {fetchBytes} from '../src/assets.js';
import {sampleRetina} from '../../shared/vision/retina.js';
import {cases,sceneFor,events} from '../../experiments/embodied/suite.js';
const params=new URLSearchParams(location.search),run=params.get('run'),split=params.get('split'),seeds=2;
const status=document.querySelector('#status');
async function retain(event,data){const r=await fetch('/__embodied',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run,event,data})});if(!r.ok)throw Error(await r.text());}
try{
 const runtime=await loadLabRuntime(location.origin+'/'),bytes=await fetchBytes('/assets/scene.json.gz'),arena=new LabArena(document.querySelector('#arena'),JSON.parse(new TextDecoder().decode(bytes)));arena.renderer.setAnimationLoop(null);
 const all=cases(split,seeds),started=performance.now();
 await retain('start',{format:'duckfly-eye-movies',version:1,run,split,seeds,sources:getSources({'web/tests/embodied-vision.js':__embodiedHash}),expectedTrials:all.length});
 for(const c of all){
  const e=new Experiment(runtime,sceneFor(c,'original')),frames=[];arena.setScene(e.scene);
  try{for(let tick=0;tick<200;tick++){
   events(e,c,tick);let packets=null;
   if(e.needsFrames()){arena.updateLab(e.world.state());packets=arena.captureEyes(tick*.02,tick);}
   const s=await e.step(packets),p=packets?.['duck-1'];
   if(p){const a=s.agents['duck-1'];frames.push({time:tick*.02,retina:Array.from(sampleRetina(p.pixels,p.calibration)),target:{visible:!!a.vision.target.visible,bearing:a.vision.target.bearing},pose:p.pose,fallen:s.body.ducks[0].fallen});}
   if(tick%50===0)await new Promise(r=>setTimeout(r,0));
  }await retain('trial',{id:c.id,family:c.family,condition:'original',frames});status.textContent=`${c.id}: ${frames.length} actual eye frames`;}finally{e.dispose();}
 }
 await retain('complete',{complete:true,elapsedSeconds:(performance.now()-started)/1000});status.textContent='Complete: '+run;
}catch(e){status.textContent='ERROR: '+e.stack;}
