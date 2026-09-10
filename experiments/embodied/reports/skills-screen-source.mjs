import fs from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import loadMujoco from '../../web/node_modules/@mujoco/mujoco/mujoco.js';
import * as ort from '../../web/node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs';
import {LabWorld,mountTemplate} from '../../web/src/lab/lab-world.js';
import {defaultScene} from '../../web/src/lab/scene.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const template=JSON.parse(gunzipSync(read('../../shared/assets/Simulation/lab-template.json.gz')));
const pose=[0,-.0873,-.4579,-.0049,.453,.3491,.3491,0,0,0,.0873,.4579,.0049,-.453].map(Math.fround);
if(JSON.stringify(pose)!==JSON.stringify(template.config.defaultPose)||template.config.actionScale!==1)throw Error('Policy pose/scale mismatch');
const order=['left_hip_yaw','left_hip_roll','left_hip_pitch','left_knee','left_ankle','neck_pitch','head_pitch','head_yaw','head_roll','right_hip_yaw','right_hip_roll','right_hip_pitch','right_knee','right_ankle'];
if(JSON.stringify(order)!==JSON.stringify(template.names.actuators))throw Error('Joint order mismatch');
ort.env.wasm.numThreads=1;const mj=await loadMujoco();mountTemplate(mj,template);
const sessions={},assets={};
for(const [name,path] of Object.entries({walking:'../../shared/assets/Policies/alpha_walking.onnx',standing:'policies/alpha_stand.onnx',kick:'policies/ball_kick_left.onnx'})){
 const bytes=read(path);sessions[name]=await ort.InferenceSession.create(new Uint8Array(bytes),{executionProviders:['wasm']});
 if(sessions[name].inputNames.length!==1||sessions[name].outputNames.length!==1)throw Error('Unsupported recurrent/multi-output contract');
 assets[name]={path,sha256:hash(bytes),inputs:sessions[name].inputMetadata,outputs:sessions[name].outputMetadata};
}
// Fixed gate before outcomes: eight offsets, a no-kick twin, no additional falls,
// kick moves the ball at least 5 cm further on at least 7/8 pairs. Recovery is a
// separate probe; standing is never assumed to mean get-up from a fall.
const trials=[];
for(const family of ['kick','standing','recovery'])for(let seed=0;seed<8;seed++)for(const condition of family==='kick'?['walking','kick']:['walking','standing']){
 const scene=defaultScene('empty');scene.ducks[0].spawn=[0,0,(seed-3.5)*.12];
 if(family==='kick')scene.props=[{id:'ball',kind:'ball',position:[2,2,.035],size:[.07,.07,.07],movable:true,mass:.025,friction:.6}];
 const w=new LabWorld(mj,template,sessions.walking,ort.Tensor,scene),robot=w.robots[0],trace=[];let initialBall=null;
 try{
  for(let tick=0;tick<400;tick++){
   if(tick===100){
    if(family==='kick'){
     const b=w.state().ducks[0],yaw=b.heading,dx=.09+(seed%4-1.5)*.004,dy=.042+(Math.floor(seed/4)-.5)*.008;
     initialBall=[b.position[0]+Math.cos(yaw)*dx-Math.sin(yaw)*dy,b.position[1]+Math.sin(yaw)*dx+Math.cos(yaw)*dy,.035];w.moveProp('ball',initialBall,0);
    }
    if(family==='recovery'){
     const angle=(seed%2?1:-1)*Math.PI/2;w.d.qpos.set([Math.cos(angle/2),Math.sin(angle/2),0,0],robot.c.qa+3);w.d.qpos[robot.c.qa+2]=.09;w.d.qvel.fill(0);mj.mj_forward(w.m,w.d);
    }
   }
   robot.session=family==='kick'?(condition==='kick'&&tick>=100&&tick<125?sessions.kick:sessions.walking):(condition==='standing'&&tick>=100?sessions.standing:sessions.walking);
   const vx=family==='kick'&&tick>=225?.15:0,s=await w.step({'duck-1':{vx,yaw:0,head:[0,0,0,0]}}),b=s.ducks[0];
   trace.push({tick,position:b.position,tilt:b.tilt,fallen:b.fallen,speed:b.speed,ball:s.props[0]?.position,action:Array.from(robot.lastAction),policy:robot.session===sessions.kick?'kick':robot.session===sessions.standing?'standing':'walking'});
  }
  const end=trace.at(-1),late=trace.slice(300),ballDistance=initialBall?Math.hypot(end.ball[0]-initialBall[0],end.ball[1]-initialBall[1]):null;
  const trial={family,seed,condition,fallen:trace.some(t=>t.fallen),lateTilt:late.reduce((s,t)=>s+t.tilt,0)/late.length,upright:late.every(t=>t.tilt<20&&t.position[2]>.09),ballDistance,trace};trials.push(trial);
  console.log(JSON.stringify({family,seed,condition,fallen:trial.fallen,upright:trial.upright,ballDistance}));
 }finally{w.dispose();}
}
const kicks=trials.filter(t=>t.condition==='kick'),controls=trials.filter(t=>t.family==='kick'&&t.condition==='walking');
const report={format:'duckfly-body-skill-screen',version:1,assets,sourceSha256:hash(read('skills.mjs')),contract:{pose,order,command:'Zero 13D during one-shot; 0.5 seconds; previous action retained across handoff as upstream does',physics:'Existing BAM and MuJoCo; sideways initial recovery fixture only; no teleport during recovery'},gates:{kick:kicks.every(t=>!t.fallen)&&kicks.filter((t,i)=>t.ballDistance-controls[i].ballDistance>=.05).length>=7,recovery:trials.filter(t=>t.family==='recovery'&&t.condition==='standing').every(t=>t.upright)},trials};
fs.writeFileSync(new URL('reports/skills.json.gz',import.meta.url),gzipSync(JSON.stringify(report)));fs.writeFileSync(new URL('reports/skills-summary.json',import.meta.url),JSON.stringify({...report,trials:trials.map(({trace,...t})=>t)},null,2));
for(const session of Object.values(sessions))await session.release();
