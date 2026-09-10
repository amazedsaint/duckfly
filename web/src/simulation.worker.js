import { createWorld } from './runtime.js';
import { Brain } from './brain.js';
let world,brain,body,paused=false,mode='brain',manual=[0,0],timer,running=false,failed=false;
let statsAt=performance.now(),statsTime=0,factor=0;
const send=message=>self.postMessage(message);
function snapshot(b=null){send({type:'state',body,brain:b,paused,mode,factor});}
function schedule(){clearTimeout(timer);if(!paused&&!failed)timer=setTimeout(tick,0);}
async function tick(){
  if(paused||running||failed)return;
  running=true;const start=performance.now();
  try {
    const b=brain.step(body);const command=mode==='brain'?[b.vx,b.yaw]:manual;
    body=await world.step(...command);
    if(start-statsAt>=1000){factor=(body.time-statsTime)/((start-statsAt)/1000);statsAt=start;statsTime=body.time;}
    snapshot(b);
  }catch(error){failed=true;paused=true;send({type:'error',message:error.message});}
  finally{running=false;if(!paused&&!failed)timer=setTimeout(tick,Math.max(0,20-(performance.now()-start)));}
}
// Serialize messages behind the in-flight inference. Reset must never race a tick.
const inbox=[];
self.onmessage=({data})=>{inbox.push(data);drain();};
let draining=false;
async function drain(){
  if(draining)return;draining=true;
  while(inbox.length){
    const msg=inbox.shift();
    if(msg.type==='init'){
      try {
        const root=msg.base;
        const [w,circuit]=await Promise.all([createWorld(message=>send({type:'loading',message})),fetch(`${root}assets/Brain/circuit.json`).then(r=>r.json())]);
        world=w;brain=new Brain(circuit);body=world.state(0);brain.stimulate('walk');
        statsAt=performance.now();statsTime=0;send({type:'ready'});snapshot();schedule();
      }catch(error){failed=true;send({type:'error',message:error.message});}
      continue;
    }
    if(!world||failed)continue;
    clearTimeout(timer);
    while(running)await new Promise(resolve=>setTimeout(resolve,1));
    clearTimeout(timer);
    if(msg.type==='pause'){paused=msg.value;statsAt=performance.now();statsTime=body.time;}
    if(msg.type==='reset'){body=world.reset();brain.reset();manual=[0,0];statsAt=performance.now();statsTime=0;factor=0;snapshot({forward:0,left:0,right:0,loom:0,population:0,spikeCount:0,fired:[],vx:0,yaw:0,event:'Circuit reset'});}
    if(msg.type==='stimulus')brain.stimulate(msg.kind);
    if(msg.type==='mode'){mode=msg.value;manual=[0,0];}
    if(msg.type==='manual')manual=msg.command;
    if(msg.type==='silence')brain.silenced=msg.value;
    if(msg.type==='feedback')brain.feedback=msg.value;
    if(msg.type==='push')world.pushTicks=10;
    snapshot();schedule();
  }
  draining=false;
}
