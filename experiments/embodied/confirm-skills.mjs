import fs from 'node:fs';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import loadMujoco from '../../web/node_modules/@mujoco/mujoco/mujoco.js';
import * as ort from '../../web/node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs';
import {Experiment} from '../../web/src/lab/experiment.js';
import {mountTemplate} from '../../web/src/lab/lab-world.js';
import {defaultScene} from '../../web/src/lab/scene.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const template=JSON.parse(gunzipSync(read('../../shared/assets/Simulation/lab-template.json.gz'))),circuit=JSON.parse(read('../../shared/assets/Brain/circuit.json'));
ort.env.wasm.numThreads=1;const mj=await loadMujoco();mountTemplate(mj,template);const sessions={};
for(const [name,file] of Object.entries({walking:'alpha_walking.onnx',standing:'alpha_stand.onnx',kick:'ball_kick_left.onnx'}))sessions[name]=await ort.InferenceSession.create(new Uint8Array(read('../../shared/assets/Policies/'+file)),{executionProviders:['wasm']});
const runtime={mj,template,circuit,session:sessions.walking,skillSessions:{standing:sessions.standing,kick:sessions.kick},Tensor:ort.Tensor};
const pixels=new Uint8Array(96*64*4);for(let y=16;y<32;y++)for(let x=38;x<54;x++)pixels.set([238,69,129,255],(y*96+x)*4);
// Confirm before outcomes: 16 recovery fixtures spanning front/back/side,
// angle and yaw, plus paired no-recovery controls. At least 80% must recover.
// Neural trigger: normal must kick, the four input/output cuts must not.
const trials=[];
for(const family of ['recovery','trigger'])for(let seed=0;seed<(family==='recovery'?16:4);seed++)for(const condition of family==='recovery'?['walking','recover']:['normal','forward-cut','covered','output-cut','stale']){
 const scene=defaultScene(family==='trigger'?'kick':'empty');scene.seed=`skill-confirm-${family}-${seed}`;scene.ducks[0].spawn[2]=(seed-7.5)*.13;
 if(condition==='forward-cut')scene.ducks[0].silence='forward';if(condition==='covered')scene.ducks[0].eye='none';if(condition==='output-cut')scene.ducks[0].motorEnabled=false;
 const e=new Experiment(runtime,scene),trace=[];let replayChecked=false;
 try{
  for(let tick=0;tick<650;tick++){
   if(family==='recovery'&&tick===100){
    const r=e.world.robots[0],angle=(75+(seed%4)*10)*Math.PI/180*(seed%8<4?1:-1),axis=seed<8?'roll':'pitch';
    const yaw=scene.ducks[0].spawn[2],c=Math.cos(angle/2),s=Math.sin(angle/2),cy=Math.cos(yaw/2),sy=Math.sin(yaw/2);
    const q=axis==='roll'?[cy*c,cy*s,sy*s,sy*c]:[cy*c,-sy*s,cy*s,sy*c];
    e.world.d.qpos.set(q,r.c.qa+3);e.world.d.qpos[r.c.qa+2]=.09;e.world.d.qvel.fill(0);mj.mj_forward(e.world.m,e.world.d);
   }
   if(family==='recovery'&&tick===140&&condition==='recover')e.skill('duck-1','recover');
   const frames=e.needsFrames()?{'duck-1':condition==='stale'?null:pixels}:null;
   const state=await e.step(frames),b=state.body.ducks[0],a=state.agents['duck-1'];
   trace.push({tick,position:b.position,tilt:b.tilt,fallen:b.fallen,speed:b.speed,skill:a.skill,neural:a.neural.forward,command:state.event.causes[0].command});
   if(!replayChecked&&(a.skill.phase==='kick'||a.skill.phase==='recover')){
    const checkpoint=JSON.parse(JSON.stringify(e.checkpoint())),copy=new Experiment(runtime,scene);copy.restore(checkpoint);const frameCopy={'duck-1':condition==='stale'?null:pixels};
    // Independently restored instances receive identical subsequent camera packets.
    for(let j=0;j<12;j++){
     const x=await e.step(e.needsFrames()?frameCopy:null),y=await copy.step(copy.needsFrames()?frameCopy:null);
     if(JSON.stringify(x.body.ducks[0].position)!==JSON.stringify(y.body.ducks[0].position)||JSON.stringify(x.agents['duck-1'].skill)!==JSON.stringify(y.agents['duck-1'].skill))throw Error('Skill replay mismatch');
    }
    copy.dispose();e.restore(checkpoint);e.replaying=false;replayChecked=true;
   }
  }
  const trial={family,seed,condition,axis:seed<8?'roll':'pitch',upright:trace.slice(-50).every(t=>t.tilt<12&&t.position[2]>.09),fallCleared:!trace.at(-1).fallen,kicked:trace.some(t=>t.skill.phase==='kick'),extraFall:family==='trigger'&&trace.some(t=>t.fallen),replayChecked,trace};trials.push(trial);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(trial).filter(([k])=>k!=='trace'))));
 }finally{e.dispose();}
}
const recovered=trials.filter(t=>t.condition==='recover'),normal=trials.filter(t=>t.condition==='normal'),cuts=trials.filter(t=>t.family==='trigger'&&t.condition!=='normal');
const sources={};for(const p of ['confirm-skills.mjs','../../web/src/lab/body-skills.js','../../web/src/lab/experiment.js','../../web/src/lab/lab-world.js'])sources[p]={sha256:hash(read(p)),code:read(p).toString()};
const report={format:'duckfly-body-skills-confirmation',version:1,gate:{recovery:recovered.filter(t=>t.upright&&t.fallCleared).length/16>=.8,trigger:normal.every(t=>t.kicked&&!t.extraFall)&&cuts.every(t=>!t.kicked&&!t.extraFall)},interpretation:'Actual MuJoCo/policies and fly circuit; fixed pink image stimulus for neural intervention tests, not a rendered scene. Recovery rotation initializes a fall, then physics settles for 0.8 s before intervention.',sources,trials};
fs.writeFileSync(new URL('reports/skills-confirm.json.gz',import.meta.url),gzipSync(JSON.stringify(report)));fs.writeFileSync(new URL('reports/skills-confirm-summary.json',import.meta.url),JSON.stringify({...report,sources:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,v.sha256])),trials:trials.map(({trace,...t})=>t)},null,2));
for(const session of Object.values(sessions))await session.release();
