import {loadLabRuntime} from '../../../web/src/lab/lab-runtime.js';
import {Experiment} from '../../../web/src/lab/experiment.js';
import {LabArena} from '../../../web/src/lab/lab-arena.js';
import {defaultScene} from '../../../web/src/lab/scene.js';
import {fetchBytes} from '../../../web/src/assets.js';
import {sampleRetina} from '../../../shared/vision/retina.js';
import {Panorama} from './stimulus.js';
import {ASSETS} from './provenance.js';
const $=s=>document.querySelector(s),status=$('#status'),run=new URLSearchParams(location.search).get('run')??'camera-pose-reconstruction-v1';
const decode=s=>new Float32Array(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const retain=async(event,data)=>{const r=await fetch('/__pose_retain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run,event,data})});if(!r.ok)throw Error(await r.text());};
let runtime,arena,panorama,plan,assets;
window.poseReplay={ready:false,error:null};
function sceneFor(seed){const scene=defaultScene('empty');scene.name='Motion room research';scene.seed=`motion-room-${seed}`;Object.assign(scene.ducks[0],{mode:'brain',visionModel:'motion-opponency-v1',activeLook:false,headStabilization:false,flowSteer:false,feedback:true,temporal:'off',gfGain:6});return scene;}
function assertBody(actual,expected,errors){
  for(const key of ['heading','speed','distance','tilt']){const d=Math.abs(actual[key]-expected[key]);errors[key]=Math.max(errors[key]??0,d);if(d>1e-8)throw Error(`Body ${key} parity failed: ${d}`);}
  for(let i=0;i<3;i++){const d=Math.abs(actual.position[i]-expected.position[i]);errors.position=Math.max(errors.position??0,d);if(d>1e-8)throw Error(`Body position parity failed: ${d}`);}
  if(actual.fallen!==expected.fallen)throw Error('Fallen-state parity differs');
}
async function reconstruct(trial){
  const experiment=new Experiment(runtime,sceneFor(trial.parameters.seed)),agent=experiment.agents.get('duck-1'),originalStep=agent.brain.step.bind(agent.brain);let command=[.3,0],torque=0;
  agent.adapter.sense=()=>({forward:.12,turn:0,loomL:0,loomR:0,loomPathway:'both',head:[0,0,0,0],headReason:'Fixed head for visual assay',fresh:true,gate:false,gateReason:'Fixed forward-drive task; visual intervention only affects steering'});
  agent.brain.step=(body,input)=>({...originalStep(body,input),vx:command[0],yaw:command[1]});
  arena.setScene(experiment.scene);panorama.render();const frames=[],errors={retina:0};
  try{
    for(let tick=0;tick<100;tick++){
      let f=null;if(experiment.needsFrames()){arena.updateLab(experiment.world.state());f=arena.captureEyes(experiment.tick*.02,experiment.tick);}
      await experiment.step(f);
    }
    const initial=experiment.world.state().ducks[0];assertBody(initial,trial.initial,errors);
    const robot=experiment.world.robots[0],push=robot.applyPush.bind(robot);robot.applyPush=()=>{push();robot.d.xfrc_applied[robot.c.trunk*6+5]+=torque;};
    for(const record of trial.trace){
      command=record.body.command;torque=record.torque;panorama.render({...trial.parameters,angle:record.panoramaAngle});let packets=null;
      if(experiment.needsFrames()){
        const body=experiment.world.state(),duck=body.ducks[0];arena.updateLab(body);packets=arena.captureEyes(experiment.tick*.02,experiment.tick);const packet=packets['duck-1'];
        if(!record.frame||packet.frameId!==record.frame.frameId||Math.abs(packet.captureTime-record.frame.captureTime)>1e-8)throw Error('Camera frame clock differs');
        for(const eye of ['left','right']){const actual=sampleRetina(packet.views[eye],packet.calibration),expected=decode(record.frame.retina[eye]);for(let i=0;i<721;i++)errors.retina=Math.max(errors.retina,Math.abs(actual[i]-expected[i]));}
        if(errors.retina>1e-6)throw Error('Rendered retinal oracle differs: '+errors.retina);
        const cameras=arena.ducks.get('duck-1').eyes;
        frames.push({captureTime:packet.captureTime,frameId:packet.frameId,sourceId:packet.sourceId,clock:packet.clock,time:record.time,panoramaAngle:record.panoramaAngle,
          cameraPose:[...packet.pose],headPose:[...duck.headPose],trunk:{heading:duck.heading,position:[...duck.position]},
          eyes:cameras.map(camera=>({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),matrixWorld:camera.matrixWorld.toArray(),projectionMatrix:camera.projectionMatrix.toArray(),fov:camera.fov,aspect:camera.aspect})),
          provenance:'Reconstructed from original applied commands; body and exact sampled-retina parity checked.'});
      }
      const state=await experiment.step(packets);assertBody(state.body.ducks[0],record.body,errors);
      if(Math.abs(state.body.time-record.bodyTime)>1e-8)throw Error('Body clock differs');
      if(experiment.tick%20===0)await pause();
    }
    return {id:trial.id,condition:trial.condition,seed:trial.parameters.seed,accepted:true,errors,frames,bodyTicks:trial.trace.length};
  }finally{experiment.dispose();}
}
$('#start').addEventListener('click',async()=>{const button=$('#start');button.disabled=true;try{
  await retain('start',{format:'duckfly-reconstructed-camera-poses',version:1,expectedTrials:6,assets,limits:{bodyAbsoluteError:1e-8,retinalSampleError:1e-6},originalSourceSha256:plan.sourceSha256});
  const trials=[];for(const trial of plan.trials){status.textContent=`Reconstructing ${trial.id} (${trials.length+1}/6)…`;const result=await reconstruct(trial);trials.push(result);await retain('trial',result);}
  await retain('complete',{complete:true,trialsAccepted:trials.length,physicalBenefit:false});status.textContent='All six reconstructed trajectories passed body and retinal parity.';window.poseReplay.result=trials.map(t=>({id:t.id,errors:t.errors}));
}catch(error){status.textContent='ERROR: '+error.message;window.poseReplay.error=error.stack;try{await retain('failure',{message:error.message,stack:error.stack});}catch{}}});
try{
  plan=await(await fetch('/__pose_original')).json();runtime=await loadLabRuntime(location.origin+'/',text=>status.textContent=text);
  assets=Object.fromEntries(await Promise.all(ASSETS.map(async a=>{const bytes=await fetchBytes(a.url),digest=await crypto.subtle.digest('SHA-256',bytes);return [a.path,Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')];})));
  const geometry=JSON.parse(new TextDecoder().decode(await fetchBytes('/assets/scene.json.gz')));arena=new LabArena($('#arena'),geometry);arena.renderer.setAnimationLoop(null);panorama=new Panorama(arena);
  $('#start').disabled=false;status.textContent='Ready to reconstruct the archived trajectories.';window.poseReplay.ready=true;
}catch(error){status.textContent='ERROR: '+error.message;window.poseReplay.error=error.stack;}
