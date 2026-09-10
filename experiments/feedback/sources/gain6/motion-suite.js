import { defaultScene } from '../../web/src/lab/scene.js';
import { seededRandom } from '../../web/src/brain.js';
import { RotationMotion,multiply } from './rotation-motion.js';
export const MOTION_CONDITIONS=['original','rotation','inverted'];
export const MOTION_FAMILIES=['scan','walking','approach','lateral'];
export function motionCases(split,seeds){return MOTION_FAMILIES.flatMap(family=>Array.from({length:seeds},(_,index)=>{
 const id=`rot-${split}-${family}-${index}`,r=seededRandom(id);return {id,family,index,phase:r()*Math.PI*2,x:1.1+r()*.12,y:(r()-.5)*.06,size:.16+r()*.07,speed:.25+r()*.07,sign:index%2?1:-1};
}));}
export function motionScene(c){const s=defaultScene('empty');s.seed=c.id;s.name=c.id;s.challenge.duration=3;s.challenge.goal=[1.5,0];
 Object.assign(s.ducks[0],{visionModel:'motion-opponency-v1',mode:c.family==='scan'?'manual':'brain',gfGain:6});
 const prop=(id,x,y,size,color)=>({id,kind:'block',position:[x,y,.17],size:[size,size,.3],color,motion:[0,0,0]});
 s.props=[prop('background-a',1.4,.7,.2,'#262626'),prop('background-b',1.4,-.7,.2,'#eeeeee')];
 if(['approach','lateral'].includes(c.family))s.props.unshift({id:'threat',kind:'ball',position:c.family==='approach'?[c.x,c.y,.17]:[c.x,c.sign*.5,.17],size:[c.size,c.size,c.size],color:c.sign>0?'#ededed':'#202020',motion:c.family==='approach'?[-c.speed,0,0]:[0,-c.sign*.28,0]});
 return s;
}
export function configureMotion(e,c,condition){const a=e.agents.get('duck-1');
 if(c.family!=='scan')e.stimulus('duck-1','walk');
 else{const sense=a.adapter.sense.bind(a.adapter);a.adapter.sense=(vision,duck,time,...rest)=>{const s=sense(vision,duck,time,...rest);s.head=[.1*Math.sin(time*2+c.phase),0,.3*Math.sin(time*3+c.phase),0];return s;};}
 if(condition==='original')return;
 const eyes=[new RotationMotion(condition==='inverted'?-1:1),new RotationMotion(condition==='inverted'?-1:1)],encode=a.eyes.encode.bind(a.eyes);
 a.eyes.encode=(p,time,duck)=>{
  const v=encode(p,time,duck);
  if(!v?.capture.accepted)return v;
  const motion=eyes.map((eye,i)=>{
   const angle=(i===0?1:-1)*p.calibration.eyeYaw*Math.PI/180;
   const q=multiply(p.pose.slice(3),[Math.cos(angle/2),0,Math.sin(angle/2),0]);
   return eye.step(p.views[i===0?'left':'right'],p.captureTime,p.calibration,[...p.pose.slice(0,3),...q]);
  });
  return {...v,loomL:motion[0].loom,loomR:motion[1].loom,eyes:motion.map(m=>({loom:m.loom,overlap:m.rotationOverlap})),flow:motion[0].flow};
 };
}
