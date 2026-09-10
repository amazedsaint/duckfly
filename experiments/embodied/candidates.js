import {opticalHeading} from '../feedback/candidates.js';
import {EYE_CALIBRATION} from '../../shared/vision/frame.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
export const CONDITIONS=['original','scan','memory','wrong-memory','graded','body-feedback','wrong-feedback'];
// Fixed before pilot. No object geometry enters this controller.
export class EmbodiedCandidate {
  constructor(kind){this.kind=kind;this.lastSeen=-Infinity;this.direction=0;this.speed=0;this.error=0;this.tick=0;this.diagnostics={};}
  sense(input,vision,duck,time,body){
    const result={...input,head:[...input.head]},fresh=input.fresh&&duck.eye!=='none';
    const object=duck.mode==='flock'?vision?.neighbor:vision?.target;
    if(['memory','wrong-memory'].includes(this.kind)){
      if(fresh&&object?.visible){
        const optical=opticalHeading(vision.capture?.pose);
        const half=Math.tan(EYE_CALIBRATION.verticalFov*Math.PI/360)*EYE_CALIBRATION.aspect;
        this.direction=wrap((optical??body.heading)+Math.atan(object.bearing*half));this.lastSeen=time;
      }
      const age=time-this.lastSeen,confidence=clamp(1-age/2.5,0,1);
      const relative=wrap(this.direction-body.heading)*(this.kind==='wrong-memory'?-1:1);
      if(fresh&&!object?.visible&&confidence>0){
        result.head[2]=clamp(relative+.12*(1-confidence)*Math.sin(time*4),-.35,.35);
        result.turn=clamp(relative*.12,-.12,.12)*confidence;
        result.headReason='Remembered visual direction';
      }
      if(!fresh){result.forward=0;result.turn=0;}
      this.diagnostics={confidence,age:Number.isFinite(age)?age:null,directionError:relative,remembering:fresh&&!object?.visible&&confidence>0};
    }
    return result;
  }
  beforeBrain(brain,body){
    if(!['body-feedback','wrong-feedback'].includes(this.kind))return;
    const expected=Math.abs(body.command[0]),measured=body.speed;
    const difference=clamp((expected-measured)/.3,0,1),contact=body.contacts.some(Boolean)?1:0;
    this.error+=(difference*contact-this.error)*.04;
    const drive=this.kind==='wrong-feedback'?(Math.sin(this.tick*.17)+1)*.5:this.error;
    // Explicit experimental current into the existing ascending pool; no new anatomical edges.
    if(brain.feedback&&drive>.05)brain.sim.stimulate(brain.sim.ascend,drive*.04,20);
    this.tick++;this.diagnostics={commandError:this.error,ascendingCurrent:drive*.04,contact:!!contact};
  }
  afterBrain(neural){
    if(this.kind!=='graded')return neural;
    const desired=neural.gfHeld?0:clamp((neural.forward-2)/118,0,1)*.3;
    this.speed=neural.gfHeld?0:this.speed+clamp(desired-this.speed,-.012,.012);
    this.diagnostics={desired,gradedSpeed:this.speed};
    return {...neural,vx:this.speed};
  }
  checkpoint(){return structuredClone({kind:this.kind,lastSeen:Number.isFinite(this.lastSeen)?this.lastSeen:null,direction:this.direction,speed:this.speed,error:this.error,tick:this.tick,diagnostics:this.diagnostics});}
  restore(s){Object.assign(this,structuredClone(s));this.lastSeen=s.lastSeen??-Infinity;}
}
export function configureResearch(e,kind,weights){
  const a=e.agents.get('duck-1'),candidate=new EmbodiedCandidate(kind);
  if(weights)a.adapter.weights={...a.adapter.weights,...weights};
  const sense=a.adapter.sense.bind(a.adapter),step=a.brain.step.bind(a.brain);
  a.adapter.sense=(vision,duck,time,fields,body)=>candidate.sense(sense(vision,duck,time,fields,body),vision,duck,time,body);
  a.brain.step=(body,input)=>{candidate.beforeBrain(a.brain,body);return candidate.afterBrain(step(body,input));};
  return candidate;
}
