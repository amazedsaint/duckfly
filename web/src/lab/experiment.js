import { Brain } from '../brain.js';
import { LabWorld } from './lab-world.js';
import { SensoryAdapter } from './vision.js';
import { VisualSystem } from './visual-system.js';
import { serializeFrame,deserializeFrame } from '../../../shared/vision/frame.js';
import { validateScene, resetScene } from './scene.js';
import { clamp } from '../bam.js';
import { TemporalLoop } from '../../../shared/vision/temporal/loop.js';
import { scheduledMotion, labInput } from './guided-labs.js';
import { BodySkills } from './body-skills.js';

export class Experiment {
  constructor(runtime,scene){this.runtime=runtime;this.history=[];this.events=[];this.frameTape=new Map();this.branchNumber=0;this.configure(scene);}
  configure(scene){
    const next=resetScene(scene),r=this.runtime;
    for(const p of next.props)if(p.behavior)p.behavior.startedAt=0;
    const world=new LabWorld(r.mj,r.template,r.session,r.Tensor,next,r.skillSessions);
    this.world?.dispose();this.world=world;this.scene=next;this.tick=0;this.replaying=false;this.recordedUntilTick=0;this.cost=0;this.forceFrames=false;
    this.agents=new Map(next.ducks.map(d=>[d.id,{brain:new Brain(r.circuit,`${next.seed}/${d.id}`),skills:new BodySkills(),eyes:new VisualSystem(),webcam:new VisualSystem(),adapter:new SensoryAdapter(d.adapter),vision:null,neural:null,input:null}]));
    this.history=[];this.events=[];this.frameTape.clear();this.scores={};this.branchNumber=0;this.preparedTick=-1;
    this.applySettings();this.remember();
  }
  applySettings(){for(const d of this.scene.ducks){const a=this.agents.get(d.id);a.brain.feedback=d.feedback;a.brain.intervene(d.silence);a.brain.sim.setGFGain(d.gfGain);a.adapter.weights={...d.adapter};
    if(d.temporal==='off')a.temporal=null;
    else if(a.temporal?.mode!==d.temporal){if(!this.runtime.temporalDecoder)throw Error('Temporal research model unavailable');a.temporal=new TemporalLoop(this.runtime.temporalDecoder,d.temporal);}
  }}
  updateDuck(id,patch){
    const next=validateScene({...this.scene,ducks:this.scene.ducks.map(d=>d.id===id?{...d,...patch}:d)});
    this.branch();this.scene=next;this.applySettings();
    const a=this.agents.get(id),d=this.scene.ducks.find(d=>d.id===id);
    if(a?.temporal&&(d.eye!=='both'||d.source!=='eyes'))a.temporal.invalidate(this.tick*.02);
    this.forceFrames=true;
  }
  branch(){
    if(!this.replaying)return;
    this.history=this.history.filter(h=>h.tick<=this.tick);this.events=this.events.filter(e=>e.tick<=this.tick);
    for(const tick of this.frameTape.keys())if(tick>=this.tick)this.frameTape.delete(tick);
    this.replaying=false;this.branchNumber++;
  }
  stimulus(id,kind){this.branch();this.agents.get(id)?.brain.stimulate(kind);}
  skill(id,kind){
    if(!this.runtime.skillSessions?.[kind==='recover'?'standing':'kick'])throw Error('Body skill unavailable');
    const d=this.scene.ducks.find(d=>d.id===id);if(!d)throw Error('Select a duck');
    if(!d.motorEnabled||d.motorGain===0||d.silence==='output')throw Error('Connect body commands before requesting a skill');
    this.branch();return this.agents.get(id).skills.request(kind,this.world.state().ducks.find(b=>b.id===id));
  }
  moveProp(id,position,yaw){
    const next=validateScene({...this.scene,props:this.scene.props.map(p=>p.id===id?{...p,position,yaw,motion:[0,0,0],behavior:null}:p)});
    this.branch();this.scene=next;if(this.scene.lab&&id==='object')this.scene.lab.scripted=false;this.world.moveProp(id,position,yaw);this.forceFrames=true;
  }
  setPropBehavior(id,behavior){
    const prop=this.scene.props.find(p=>p.id===id),body=this.world.state().props.find(p=>p.id===id);
    if(!prop||!body)throw Error('Select an existing prop');
    if(prop.movable)throw Error('Changing a free body to scripted motion requires a scene restart');
    const patch={position:body.position,motion:[0,0,0],behavior:behavior?{...behavior,startedAt:this.world.d.time}:null};
    const next=validateScene({...this.scene,props:this.scene.props.map(p=>p.id===id?{...p,...patch}:p)});
    this.branch();this.scene=next;
    if(this.scene.lab&&id==='object')this.scene.lab.scripted=false;
    this.world.moveProp(id,body.position,prop.yaw);
    Object.assign(this.world.props.find(p=>p.id===id),structuredClone(next.props.find(p=>p.id===id)));
    this.forceFrames=true;
  }
  prepareTick(){
    if(this.preparedTick===this.tick)return;this.preparedTick=this.tick;
    const motion=scheduledMotion(this.scene.lab,this.tick),p=this.world.props.find(p=>p.id==='object');
    if(!motion||!p)return;
    const position=this.world.state().props.find(s=>s.id===p.id).position;
    this.world.moveProp(p.id,position,p.yaw);
    p.motion=[...motion];p.position=position.map((v,i)=>v-motion[i]*this.world.d.time);
    Object.assign(this.scene.props.find(s=>s.id===p.id),{motion:[...motion],position:[...p.position]});
    this.forceFrames=true;
  }
  frameInterval(){return this.scene.ducks.some(d=>d.visionModel!=='marker-v1'||d.temporal!=='off')?2:5;}
  resetLiveInput(){if(!this.replaying){for(const d of this.scene.ducks)if(d.source==='webcam'){const a=this.agents.get(d.id);a.webcam.reset();a.vision=null;}this.forceFrames=true;}}
  needsFrames(){this.prepareTick();return (this.forceFrames||this.tick%this.frameInterval()===0)&&!(this.replaying&&this.frameTape.has(this.tick));}
  fields(body){
    const samples={odor:[0,0],light:[0,0]};
    for(let side=0;side<2;side++){
      const theta=body.heading+(side===0?1:-1)*Math.PI/2;
      const x=body.cameraPose[0]+Math.cos(theta)*.025,y=body.cameraPose[1]+Math.sin(theta)*.025;
      for(const f of this.scene.fields){const dist2=(x-f.position[0])**2+(y-f.position[1])**2;samples[f.kind][side]+=f.strength*Math.exp(-dist2/(2*f.radius*f.radius));}
    }
    return samples;
  }
  async step(frames=null){
    this.prepareTick();
    if(frames||this.tick%this.frameInterval()===0||(this.replaying&&this.frameTape.has(this.tick))){
      if(this.replaying&&this.frameTape.has(this.tick))frames=this.frameTape.get(this.tick);
      if(!frames)throw Error('Missing camera frames for this simulation tick');
      if(!this.replaying){this.frameTape.set(this.tick,structuredClone(frames));this.trimFrames();}
      for(const d of this.scene.ducks){const a=this.agents.get(d.id),pixels=d.source==='webcam'?frames.webcam:frames[d.id];
        a.vision=pixels?(d.source==='webcam'?a.webcam:a.eyes).encode(pixels,this.tick*.02,d):null;
        if(a.temporal){const body=this.world.state().ducks.find(b=>b.id===d.id);a.temporal.observe(pixels,{...body,time:this.tick*.02},d);}
      }
      this.forceFrames=false;
    }
    const state=this.world.state(),commands={},causes=[];
    for(const d of this.scene.ducks){const a=this.agents.get(d.id),body=state.ducks.find(b=>b.id===d.id);
      let input=labInput(this.scene.lab,d,state.time,a.adapter.sense(a.vision,d,state.time,this.fields(body),body));
      if(a.temporal){input={...input,...a.temporal.sensory(state.time)};if(d.silence==='motion')input={...input,loomL:0,loomR:0};}
      const before=a.brain.escapeUntil,neural=a.brain.step(body,input),gfEvent=a.brain.escapeUntil>before;a.input=input;a.neural=neural;
      const provenance={forward:input.gate?input.gateReason:'Fly circuit intent',yaw:'Fly circuit intent',head:input.headReason,vision:a.vision?.model??'absent',gfGain:d.gfGain};
      let command={vx:input.gate?0:neural.vx,yaw:neural.yaw,head:input.head};
      if(d.mode==='manual'){provenance.forward=provenance.yaw='Manual override';command={vx:d.manual[0],yaw:d.manual[1],head:input.head};}
      if(d.mode==='reactive'||d.mode==='reflex'){provenance.forward=provenance.yaw='Reactive camera rule';command={vx:(d.mode==='reactive'?input.gate:!input.fresh)||input.loomL+input.loomR>.2?0:.3,yaw:d.mode==='reflex'?0:clamp((a.vision?.target.bearing??0)*.7,-.65,.65),head:input.head};}
      if(a.temporal){command=a.temporal.motor(command,body,state.time,gfEvent);if(a.temporal.feedback.state.held)provenance.forward=provenance.yaw='Experimental GF hazard hold';}
      if(d.silence==='output'){provenance.forward=provenance.yaw='Output intervention';command={...command,vx:0,yaw:0};}
      if(!d.motorEnabled){provenance.forward=provenance.yaw='Body command connection off';command={...command,vx:0,yaw:0};}
      else if(d.motorGain!==1){provenance.gain=d.motorGain;command={...command,vx:command.vx*d.motorGain,yaw:command.yaw*d.motorGain};
        if(d.motorGain===0)provenance.forward=provenance.yaw='Body command strength is zero';}
      const skill=a.skills.step(body,neural,{...input,targetVisible:!!a.vision?.target.visible},{enabled:d.motorEnabled&&d.motorGain>0&&d.silence!=='output',kickOnSight:d.kickOnSight});
      if(skill.active||d.kickOnSight&&d.motorEnabled&&d.motorGain>0&&d.silence!=='output'){
        command={vx:0,yaw:0,head:[0,0,0,0],policy:skill.policy,clearFall:!!skill.clearFall};
        provenance.forward=provenance.yaw=skill.active?a.skills.message:neural.gfHeld?'GF stop reflex active':!input.fresh?'Visual kick waits for a fresh image':!a.skills.armed?'Hide and reveal the cue to kick again':'Visual kick experiment · waiting for a neural response';
      }
      commands[d.id]=command;
      causes.push({id:d.id,provenance,input:structuredClone(input),vision:structuredClone(a.vision),neural:structuredClone(neural),command:structuredClone(command),gfEvent,skill:a.skills.checkpoint(),temporal:a.temporal?.status(state.time)??null});
    }
    const next=await this.world.step(commands);this.cost=next.cost;this.tick++;
    if(!this.replaying)this.recordedUntilTick=this.tick;
    else if(this.tick>=this.replayUntil)this.replaying=false;
    for(const d of next.ducks){
      const distance=Math.hypot(d.position[0]-this.scene.challenge.goal[0],d.position[1]-this.scene.challenge.goal[1]);
      const score=this.scores[d.id]??{reachedAt:null,minGoalDistance:Infinity};
      const cause=causes.find(c=>c.id===d.id);score.ticks=(score.ticks??0)+1;score.visibleTicks=(score.visibleTicks??0)+Number(!!cause.vision?.target?.visible);
      score.gfEvents=(score.gfEvents??0)+Number(cause.gfEvent);score.maxTilt=Math.max(score.maxTilt??0,d.tilt);
      if(distance<this.scene.challenge.radius&&score.reachedAt===null)score.reachedAt=next.time;
      score.minGoalDistance=Math.min(score.minGoalDistance,distance);score.distance=d.distance;score.fallen=d.fallen;this.scores[d.id]=score;
    }
    if(this.scene.challenge.subject!=='ducks'){
      const p=next.props.find(p=>p.id===this.scene.challenge.subject),distance=Math.hypot(p.position[0]-this.scene.challenge.goal[0],p.position[1]-this.scene.challenge.goal[1]);
      const score=this.scores[p.id]??{reachedAt:null,minGoalDistance:Infinity};
      if(distance<this.scene.challenge.radius&&score.reachedAt===null)score.reachedAt=next.time;
      score.minGoalDistance=Math.min(score.minGoalDistance,distance);this.scores[p.id]=score;
    }
    const event={tick:this.tick,time:next.time,branch:this.branchNumber,causes,collisions:[...next.collisions]},existing=this.events.findIndex(e=>e.tick===this.tick);
    if(existing<0)this.events.push(event);else this.events[existing]=event;
    if(this.events.length>1000)this.events.shift();
    if(!this.replaying&&this.tick%25===0)this.remember();
    return this.state();
  }
  state(){return {body:this.world.state(this.cost??0),tick:this.tick,scene:this.scene,branch:this.branchNumber,replaying:this.replaying,
    agents:Object.fromEntries([...this.agents].map(([id,a])=>[id,{vision:a.vision,input:a.input,neural:a.neural,skill:a.skills.checkpoint(),temporal:a.temporal?.status(this.tick*.02)??null}])),
    scores:this.scores,history:this.history.map(h=>({tick:h.tick,time:h.tick*.02})),event:this.events.findLast(e=>e.tick<=this.tick)??null};}
  recordingView(){
    const tick=[...this.frameTape.keys()].filter(t=>t<this.tick).sort((a,b)=>b-a)[0];
    return {frames:tick===undefined?{}:this.frameTape.get(tick),events:this.events.filter(e=>e.tick<=this.tick)};
  }
  checkpoint(){return {version:4,scene:structuredClone(this.scene),tick:this.tick,branch:this.branchNumber,forceFrames:this.forceFrames,world:this.world.checkpoint(),scores:structuredClone(this.scores),
    agents:Object.fromEntries([...this.agents].map(([id,a])=>[id,{brain:a.brain.checkpoint(),skills:a.skills.checkpoint(),eyes:a.eyes.checkpoint(),webcam:a.webcam.checkpoint(),adapter:a.adapter.checkpoint(),vision:structuredClone(a.vision),input:structuredClone(a.input),neural:structuredClone(a.neural),temporal:a.temporal?.checkpoint()??null}]))};}
  trimFrames(){
    // Forced captures can be more frequent than the regular cadence. Keep a
    // complete replay window below the recording format's frame-count bound.
    while(this.frameTape.size>600&&this.history.length>1){
      this.history.shift();const oldest=this.history[0].tick;
      for(const tick of this.frameTape.keys())if(tick<oldest)this.frameTape.delete(tick);
      this.events=this.events.filter(e=>e.tick>=oldest);
    }
  }
  remember(){
    this.history.push(this.checkpoint());if(this.history.length>Math.max(16,Math.floor((this.frameInterval()===2?49:121)/this.scene.ducks.length)))this.history.shift();
    const oldest=this.history[0].tick;for(const t of this.frameTape.keys())if(t<oldest)this.frameTape.delete(t);
    this.events=this.events.filter(e=>e.tick>=oldest);
  }
  restore(checkpoint){
    if(![1,2,3,4].includes(checkpoint.version))throw Error('Unsupported experiment checkpoint');
    const scene=validateScene(checkpoint.scene);
    if(scene.ducks.length!==this.scene.ducks.length||scene.ducks.some((d,i)=>d.id!==this.scene.ducks[i].id))throw Error('Checkpoint belongs to another arena');
    this.scene=scene;this.world.scene=structuredClone(scene);
    for(const p of this.world.props)Object.assign(p,structuredClone(scene.props.find(s=>s.id===p.id)));
    this.world.restore(checkpoint.world);this.tick=checkpoint.tick;this.branchNumber=checkpoint.branch;this.forceFrames=checkpoint.forceFrames===true;this.scores=structuredClone(checkpoint.scores);
    this.preparedTick=-1;this.applySettings();
    for(const [id,a] of this.agents){const s=checkpoint.agents[id];a.brain.restore(s.brain);a.skills.restore(s.skills);a.eyes.restore(s.eyes);a.webcam.restore(s.webcam);a.adapter.restore(s.adapter);a.vision=structuredClone(s.vision);a.input=structuredClone(s.input);a.neural=structuredClone(s.neural);if(a.temporal)a.temporal.restore(s.temporal);}
    this.replaying=true;this.replayUntil=this.recordedUntilTick;return this.state();
  }
  rewind(tick){const checkpoint=this.history.find(h=>h.tick===tick);if(!checkpoint)throw Error('That checkpoint is no longer retained');return this.restore(checkpoint);}
  export(){
    return {format:'duckfly-recording',version:4,checkpoint:this.checkpoint(),recordedUntilTick:this.recordedUntilTick,history:this.history,events:this.events,
      frames:[...this.frameTape].map(([tick,frames])=>[tick,Object.fromEntries(Object.entries(frames).filter(([,v])=>v).map(([id,v])=>[id,serializeFrame(v)]))])};
  }
  import(recording){
    if(recording.format!=='duckfly-recording'||![1,2,3,4].includes(recording.version)||!Array.isArray(recording.history)||recording.history.length>121||!Array.isArray(recording.frames)||recording.frames.length>610)throw Error('Invalid recording');
    this.configure(recording.checkpoint.scene);this.recordedUntilTick=recording.recordedUntilTick??recording.checkpoint.tick;this.restore(recording.checkpoint);this.history=recording.history;this.events=recording.events??[];
    this.frameTape=new Map(recording.frames.map(([tick,frames])=>[tick,Object.fromEntries(Object.entries(frames).map(([id,value])=>{
      return [id,deserializeFrame(value)];
    }))]));
    return this.state();
  }
  dispose(){this.world.dispose();}
}
