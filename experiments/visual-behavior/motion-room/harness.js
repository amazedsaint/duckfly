import getSources from 'virtual:motion-room-sources';
import {loadLabRuntime} from '../../../web/src/lab/lab-runtime.js';
import {loadFlyvisReference} from '../../../web/src/lab/flyvis-runtime.js';
import {Experiment} from '../../../web/src/lab/experiment.js';
import {LabArena} from '../../../web/src/lab/lab-arena.js';
import {fetchBytes} from '../../../web/src/assets.js';
import {defaultScene} from '../../../web/src/lab/scene.js';
import {fitRidge,predict,scoreDecoder,LIMITS,MotionController,CONDITIONS,neuralFlowFeature} from './decoders.js';
import {Panorama,calibrationCases,calibrationPattern,physicalCases,trialStimulus,summarizeTrial,DT,FRAME_DT,WARM_TICKS,TRIAL_TICKS} from './stimulus.js';
import {RetinalModels} from './retinal-model.js';
import {ASSETS} from './provenance.js';

const $=s=>document.querySelector(s),report=$('#report'),status=$('#status');
const params=new URLSearchParams(location.search);if(params.has('run'))$('#run').value=params.get('run');if(params.has('seeds'))$('#seeds').value=params.get('seeds');
let runtime,reference,arena,panorama,calibration,assetsReceipt,busy=false;
const compact=value=>{report.textContent=JSON.stringify(value,null,2);};
const pause=()=>new Promise(r=>setTimeout(r,0));
const sources=()=>getSources({'experiments/visual-behavior/motion-room/harness.js':__motionRoomHash});
async function retain(run,event,data){const response=await fetch('/__motion_room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run,event,data})});if(!response.ok)throw Error(await response.text());return response.json();}
function sceneFor(seed){const scene=defaultScene('empty');scene.name='Motion room research';scene.seed=`motion-room-${seed}`;Object.assign(scene.ducks[0],{mode:'brain',visionModel:'motion-opponency-v1',activeLook:false,headStabilization:false,flowSteer:false,feedback:true,temporal:'off',gfGain:6});return scene;}
function bindController(experiment,controller){
  const agent=experiment.agents.get('duck-1'),original=agent.brain.step.bind(agent.brain),context={active:false,decision:{yaw:0,turn:0,route:'direct'},rawNeural:null};
  if(controller?.condition.endsWith('silenced'))for(const i of [...agent.brain.sim.dnaL,...agent.brain.sim.dnaR])agent.brain.sim.silencedNeurons[i]=1;
  // Harness-only declared sensory adapter. There are no marker/pose shortcuts.
  agent.adapter.sense=()=>({forward:.12,turn:context.active&&context.decision.route==='dna'?context.decision.turn:0,loomL:0,loomR:0,loomPathway:'both',head:[0,0,0,0],headReason:'Fixed head for visual assay',fresh:true,gate:false,gateReason:'Fixed forward-drive task; visual intervention only affects steering'});
  agent.brain.step=(body,input)=>{
    const neural=original(body,input);context.rawNeural={forward:neural.forward,left:neural.left,right:neural.right,vx:neural.vx,yaw:neural.yaw,gfHeld:neural.gfHeld,spikeCount:neural.spikeCount};
    if(!context.active)return {...neural,vx:.3,yaw:0};
    return context.decision.route==='direct'?{...neural,yaw:neural.gfHeld?0:context.decision.yaw}:neural;
  };
  return context;
}
async function settled(seed,controller){
  const experiment=new Experiment(runtime,sceneFor(seed)),context=bindController(experiment,controller);arena.setScene(experiment.scene);panorama.render();
  for(let tick=0;tick<WARM_TICKS;tick++){
    let frames=null;if(experiment.needsFrames()){arena.updateLab(experiment.world.state());frames=arena.captureEyes(experiment.tick*DT,experiment.tick);}
    await experiment.step(frames);
  }
  arena.updateLab(experiment.world.state());const body=experiment.world.state().ducks[0];
  if(body.fallen){experiment.dispose();throw Error('Common two-second body preparation fell');}
  return {experiment,context};
}
async function calibrationMovie(c){
  const {experiment}=await settled(0),models=new RetinalModels(reference),rows=[];
  try{
    // Deliberately fixed body pose during open-loop visual calibration only.
    panorama.render(calibrationPattern(c,0));arena.updateLab(experiment.world.state());
    const startTime=experiment.tick*DT,first=arena.captureEyes(startTime,experiment.tick)['duck-1'];const identity=await models.initialize(first);
    for(let frame=0;frame<50;frame++){
      const time=frame*FRAME_DT;panorama.render(calibrationPattern(c,time));const packet=arena.captureEyes(startTime+time,experiment.tick+frame*2)['duck-1'];
      const result=models.step(packet),rate=c.rate&&time>=.4?c.rate:0;
      rows.push({...result,time,rate,family:rate?c.family:c.family==='rotation'?'unchanged':c.family});
      if(frame%5===0)await pause();
    }
    return {id:c.id,condition:c.split,parameters:c,identity,rows};
  }finally{models.dispose();experiment.dispose();}
}
async function calibrate(){
  const run=$('#run').value,cases=[...calibrationCases('train'),...calibrationCases('heldout')],trials=[];
  await retain(run,'start',{format:'duckfly-motion-room-calibration',version:2,study:'calibration',expectedTrials:cases.length,sources:sources(),assets:assetsReceipt,limits:LIMITS,metadata:reference.readout.metadata,plan:cases});
  for(const c of cases){status.textContent=`Calibration ${trials.length+1}/${cases.length}: ${c.id}`;const trial=await calibrationMovie(c);trials.push(trial);await retain(run,'trial',trial);compact({latest:c.id,frames:trial.rows.length});}
  const train=trials.filter(t=>t.condition==='train').flatMap(t=>t.rows).filter(r=>r.time>=.2&&(!r.rate||r.time>=.6));
  const heldout=trials.filter(t=>t.condition==='heldout').flatMap(t=>t.rows);
  const gradients=train.filter(r=>r.rate!==0).flatMap(r=>r.neuralFlows.map(f=>f.gradientRms)).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!gradients.length)throw Error('No calibration neural gradients');
  const minimumGradient=gradients[Math.floor((gradients.length-1)*.1)]*.25;
  for(const row of [...train,...heldout])row.flyvis=neuralFlowFeature(row,minimumGradient);
  const decoders=Object.fromEntries(['flyvis','conventional'].map(key=>[key,fitRidge(train.map(r=>r[key]),train.map(r=>r.rate),.1)]));
  const scores=Object.fromEntries(Object.entries(decoders).map(([key,decoder])=>[key,scoreDecoder(decoder,heldout,key)]));
  const coverage=Object.fromEntries(['rotation','unchanged','flat-flash','flicker','illumination'].map(family=>{const rows=heldout.filter(r=>r.family===family&&r.time>=.2),flows=rows.flatMap(r=>r.neuralFlows);return [family,{frames:rows.length,eyeObservations:flows.length,availableEyes:flows.filter(f=>f.available&&f.gradientRms>=minimumGradient).length}];}));
  calibration={format:'duckfly-motion-room-calibration-result',version:2,run,representation:'raw-neural-map-flow-v1',minimumGradient,confidenceRule:'quarter of training moving-gradient tenth percentile; explained >=0.2; maximum360image-degrees/sec',coverage,decoders,scores,limits:LIMITS,admitted:Object.values(scores).every(s=>s.passed),metadata:reference.readout.metadata,trainingSamples:train.length,heldoutSamples:heldout.length};
  await retain(run,'complete',{complete:true,calibration});compact(calibration);status.textContent=calibration.admitted?'Calibration passed admission; physical comparison remains unvalidated.':'Calibration admission failed. Physical matrix remains disabled.';
  $('#physical').disabled=!calibration.admitted;
}
async function physicalTrial(c,condition){
  const controller=new MotionController(condition),{experiment,context}=await settled(c.seed,controller),models=new RetinalModels(reference),trace=[];
  const robot=experiment.world.robots[0],push=robot.applyPush.bind(robot);let torque=0;
  robot.applyPush=()=>{push();robot.d.xfrc_applied[robot.c.trunk*6+5]+=torque;};
  const initial=experiment.world.state().ducks[0],startHeading=initial.heading,started=performance.now();let desiredHeading=0,identity;
  try{
    panorama.render({...c,angle:0});arena.updateLab(experiment.world.state());const first=arena.captureEyes(experiment.tick*DT,experiment.tick)['duck-1'];identity=await models.initialize(first);context.active=true;
    for(let tick=0;tick<TRIAL_TICKS;tick++){
      const time=tick*DT,stimulus=trialStimulus(c,time),bodyTime=experiment.tick*DT;torque=stimulus.torque;desiredHeading+=stimulus.intent*DT;
      panorama.render({...c,angle:stimulus.panoramaAngle});let frames=null,frame=null;
      if(experiment.needsFrames()){
        arena.updateLab(experiment.world.state());frames=arena.captureEyes(bodyTime,experiment.tick);frame=models.step(frames['duck-1']);frame.flyvis=neuralFlowFeature(frame,calibration.minimumGradient);
        frame.predictions=Object.fromEntries(Object.entries(calibration.decoders).map(([key,decoder])=>[key,predict(decoder,frame[key])]));
        controller.observe({captureTime:frame.captureTime,availableAt:frame.availableAt,...frame.predictions});
      }
      context.decision=controller.command(bodyTime,stimulus.intent);const state=await experiment.step(frames),b=state.body.ducks[0];
      trace.push({time,bodyTime:state.body.time,torque,panoramaAngle:stimulus.panoramaAngle,intent:stimulus.intent,desiredHeading,frame,decision:{...context.decision},neural:{...context.rawNeural},body:{heading:b.heading,position:b.position,command:b.command,speed:b.speed,distance:b.distance,fallen:b.fallen,tilt:b.tilt},collisions:state.body.collisionCount});
      if(tick%10===0){arena.updateLab(state.body);arena.renderer.render(arena.scene,arena.camera);await pause();}
    }
    return {...summarizeTrial(c,condition,trace,startHeading,(performance.now()-started)/1000),initial,identity,controller:controller.checkpoint()};
  }catch(error){return {id:c.id,condition,family:c.family,failed:true,error:error.stack,trace,initial,identity,validation:{physicalBenefit:false}};}
  finally{models.dispose();experiment.dispose();}
}
async function physical(){
  if(!calibration?.admitted)throw Error('Both visual decoders must pass held-out admission before physical integration');
  const run=$('#run').value,seeds=Number($('#seeds').value),cases=physicalCases(seeds),conditions=params.has('conditions')?params.get('conditions').split(','):CONDITIONS;
  if(conditions.some(c=>!CONDITIONS.includes(c)))throw Error('Unknown physical condition');
  await retain(run,'start',{format:'duckfly-motion-room-physical',version:2,study:'physical',expectedTrials:cases.length*conditions.length,sources:sources(),assets:assetsReceipt,metadata:reference.readout.metadata,calibration,plan:cases,conditions,seeds,interpretation:'Unpromoted physical pilot. Direct and DNa routes, panorama and perturbation objectives remain separate.'});
  let count=0,failures=0;for(const c of cases)for(const condition of conditions){status.textContent=`Physical ${++count}/${cases.length*conditions.length}: ${c.id} · ${condition}`;const trial=await physicalTrial(c,condition);failures+=Number(!!trial.failed);await retain(run,'trial',trial);compact({id:trial.id,condition,metrics:trial.metrics,error:trial.error??null});}
  await retain(run,'complete',{complete:true,failures,validation:{physicalBenefit:false,requiresMatchedStudy:true}});status.textContent=`Physical pilot finished with ${failures} execution failures. No promotion decision has been made.`;
}
async function perform(fn){if(busy)return;busy=true;$('#calibrate').disabled=$('#physical').disabled=true;try{await fn();}catch(error){status.textContent='ERROR: '+error.message;compact({error:error.stack});window.motionRoom.error=error.stack;}finally{busy=false;$('#calibrate').disabled=false;$('#physical').disabled=!calibration?.admitted;window.motionRoom.status=status.textContent;window.motionRoom.calibration=calibration;}}
window.motionRoom={ready:false,status:'loading',calibration:null,error:null};
$('#calibrate').addEventListener('click',()=>perform(calibrate));$('#physical').addEventListener('click',()=>perform(physical));
try{
  runtime=await loadLabRuntime(location.origin+'/',text=>status.textContent=text);reference=await loadFlyvisReference();
  assetsReceipt=Object.fromEntries(await Promise.all(ASSETS.map(async asset=>{
    const bytes=await fetchBytes(asset.url),digest=await crypto.subtle.digest('SHA-256',bytes);
    return [asset.path,Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')];
  })));
  const assets=JSON.parse(new TextDecoder().decode(await fetchBytes('/assets/scene.json.gz')));arena=new LabArena($('#arena'),assets);arena.renderer.setAnimationLoop(null);panorama=new Panorama(arena);
  if(params.has('calibration')){const response=await fetch(`/__motion_room_calibration?run=${encodeURIComponent(params.get('calibration'))}`);if(!response.ok)throw Error(await response.text());calibration=await response.json();}
  window.motionRoom.ready=true;window.motionRoom.calibration=calibration;status.textContent='Ready. Explicitly start calibration or a qualified physical run.';$('#physical').disabled=!calibration?.admitted;
}catch(error){status.textContent='ERROR: '+error.message;window.motionRoom.error=error.stack;compact({error:error.stack});}
