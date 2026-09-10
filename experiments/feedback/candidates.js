// Research-only adapters. No production setting or default is changed here.
import { EYE_CALIBRATION } from '../../shared/vision/frame.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function opticalHeading(pose){
  if(!pose||pose.length!==7)return null;
  const [w,x,y,z]=pose.slice(3);
  const forward=[-2*(x*z+w*y),-2*(y*z-w*x)];
  return Math.hypot(...forward)>1e-6?Math.atan2(forward[1],forward[0]):null;
}
export function bodyBearing(vision,body){
  const camera=opticalHeading(vision.capture?.pose),object=vision.target;
  if(camera===null||!body||!object.visible)return null;
  const half=Math.atan(Math.tan(EYE_CALIBRATION.verticalFov*Math.PI/360)*EYE_CALIBRATION.aspect);
  const retinal=Math.atan(object.bearing*Math.tan(half));
  const angle=wrap(camera+retinal-body.heading);
  return {angle,bearing:clamp(Math.tan(clamp(angle,-half,half))/Math.tan(half),-1,1),retinal,camera};
}
export const CONDITIONS=['original','active-head','old-stabilization','body-coordinates','coordinated','no-pose','no-feedback','unrelated-phase'];
export function configureResearch(experiment,condition){
  const a=experiment.agents.get('duck-1');
  if(condition==='no-feedback')a.brain.feedback=false;
  if(condition==='unrelated-phase'){
    const step=a.brain.step.bind(a.brain);let tick=0;
    a.brain.step=(body,input)=>step({...body,phase:((tick++*73)%101)/101},input);
  }
  if(!['body-coordinates','body-no-pose','coordinated','no-pose','no-feedback','unrelated-phase'].includes(condition))return;
  const sense=a.adapter.sense.bind(a.adapter);
  a.adapter.sense=(vision,duck,time,fields,body)=>{
    const correction=vision?bodyBearing(vision,body):null;
    let adapted=vision;
    if(correction&&!['no-pose','body-no-pose'].includes(condition))adapted={...vision,target:{...vision.target,bearing:correction.bearing}};
    const input=sense(adapted,duck,time,fields,body);
    if(correction&&condition==='body-no-pose')input.head[2]=clamp(.3*correction.bearing,-.35,.35);
    else if(correction&&condition!=='body-coordinates')input.head[2]=clamp(.7*correction.angle,-.35,.35);
    input.research={condition,bodyAngle:correction?.angle??null,retinal:correction?.retinal??null};
    return input;
  };
}
