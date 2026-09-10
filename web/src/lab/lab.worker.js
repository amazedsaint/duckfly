import { loadLabRuntime } from './lab-runtime.js';
import { Experiment } from './experiment.js';
import { compareControllers,learnAdapter,trialScore } from './benchmarks.js';
let experiment,paused=true,timer,running=false,frameWait=null,ticket=0,runtime;
let cancelled=false;
const send=x=>self.postMessage(x);
const snapshot=()=>{if(experiment)send({type:'state',...experiment.state(),paused});};
const recordingView=()=>send({type:'recording-view',...experiment.recordingView()});
function schedule(){clearTimeout(timer);if(!paused)timer=setTimeout(tick,0);}
async function requestFrames(){
  return new Promise((resolve,reject)=>{
    const id=++ticket,timeout=setTimeout(()=>{frameWait=null;reject(Error('Camera rendering timed out. Resume to retry.'));},15000);
    frameWait={id,resolve:frames=>{clearTimeout(timeout);frameWait=null;resolve(frames);}};
    send({type:'vision-request',ticket:id,body:experiment.world.state(),time:experiment.tick*.02});
  });
}
async function tick(){
  if(paused||running)return;running=true;const start=performance.now();
  try{const frames=experiment.needsFrames()?await requestFrames():null;await experiment.step(frames);
    if(experiment.world.d.time>=experiment.scene.challenge.duration){paused=true;send({type:'challenge-finished'});}snapshot();}
  catch(e){paused=true;send({type:'error',message:e.message});}
  finally{running=false;if(!paused)timer=setTimeout(tick,Math.max(0,20-(performance.now()-start)));}
}
const queue=[];let draining=false;
self.onmessage=({data})=>{
  if(data.type==='cancel-job'){cancelled=true;return;}
  if(data.type==='frames'){if(frameWait?.id===data.ticket)frameWait.resolve(data.frames);return;}
  queue.push(data);drain();
};
async function drain(){
  if(draining)return;draining=true;
  while(queue.length){const msg=queue.shift();clearTimeout(timer);
    while(running)await new Promise(r=>setTimeout(r,1));clearTimeout(timer);
    try{
      if(msg.type==='init'){runtime=await loadLabRuntime(msg.base,message=>send({type:'loading',message}));experiment=new Experiment(runtime,msg.scene);send({type:'ready',scene:experiment.scene});}
      if(!experiment)continue;
      if(msg.type==='pause')paused=msg.value;
      if(msg.type==='scene'){experiment.configure(msg.scene);paused=true;send({type:'scene',scene:experiment.scene});}
      if(msg.type==='reset'){experiment.configure(experiment.scene);paused=true;send({type:'scene',scene:experiment.scene});}
      if(msg.type==='duck')experiment.updateDuck(msg.id,msg.patch);
      if(msg.type==='move-prop')experiment.moveProp(msg.id,msg.position,msg.yaw);
      if(msg.type==='stimulus')experiment.stimulus(msg.id,msg.kind);
      if(msg.type==='push'){experiment.branch();const r=experiment.world.robots.find(r=>r.id===msg.id);if(r)r.pushTicks=10;}
      if(msg.type==='rewind'){paused=true;experiment.rewind(msg.tick);recordingView();}
      if(msg.type==='branch'){experiment.branch();recordingView();}
      if(msg.type==='export')send({type:'export',recording:experiment.export()});
      if(msg.type==='import'){
        const candidate=new Experiment(runtime,msg.recording?.checkpoint?.scene);
        try{candidate.import(msg.recording);}catch(error){candidate.dispose();throw error;}
        experiment.dispose();experiment=candidate;paused=true;send({type:'scene',scene:experiment.scene});recordingView();
      }
      if(msg.type==='weights')experiment.updateDuck(msg.id,{adapter:msg.weights});
      if(msg.type==='compare'||msg.type==='learn'){
        const original=experiment;paused=true;cancelled=false;
        const progress=(label,done,total)=>send({type:'job-progress',label,done,total});
        const runTrial=async(scene,steps)=>{
          if(cancelled)throw Error('Experiment batch cancelled');
          const trial=new Experiment(runtime,scene);experiment=trial;send({type:'scene',scene});snapshot();let turnEffort=0;
          try{for(let i=0;i<steps;i++){
            if(cancelled)throw Error('Experiment batch cancelled');
            await trial.step(trial.needsFrames()?await requestFrames():null);
            turnEffort+=Math.abs(trial.world.robots[0].command[1]);if(i%5===0)snapshot();
          }return trialScore(scene,trial.state(),turnEffort);}finally{trial.dispose();}
        };
        try{
          const initial=original.scene.ducks.find(d=>d.id===msg.id)?.adapter;
          const report=await (msg.type==='learn'?learnAdapter(runTrial,progress,initial):compareControllers(runTrial,progress,msg.intervention??'gf',initial));
          if(msg.type==='learn'&&report.gate.promote)original.updateDuck(msg.id,{adapter:report.weights});
          send({type:'job-result',report});
        }catch(e){send({type:'job-error',message:e.message});}
        finally{experiment=original;send({type:'scene',scene:original.scene});recordingView();}
      }
      snapshot();schedule();
    }catch(e){send({type:'error',message:e.message});paused=true;snapshot();}
  }
  draining=false;
}
