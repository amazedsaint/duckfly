import {defaultScene,validateScene} from './scene.js';
import {addSetupDuck,addSetupProp,addSetupField} from './scene-setup-draft.js';
import {propProfile} from './prop-behavior.js';
export const AR_OBJECTS=[['target','Beacon'],['duck','Duck'],['ball','Ball'],['wall','Wall'],['block','Block'],['odor','Scent source'],['air','Air current']];
export const createARScene=()=>{
  const scene=defaultScene('target');scene.props[0].name='Beacon';
  return validateScene({...scene,version:10,name:'AR playground',seed:'ar-playground-v1',presentation:{view:'ar'}});
};
export function addARObject(scene,kind,point,profile='fixed') {
  if(!AR_OBJECTS.some(([id])=>id===kind)||!Array.isArray(point)||point.length!==2||!point.every(v=>Number.isFinite(v)&&Math.abs(v)<=10))throw Error('Invalid AR object placement');
  const next=structuredClone(scene),field=['odor','air'].includes(kind);
  if(!field){
    const radius=kind==='duck'?.13:kind==='wall'?.21:kind==='target'?.05:.09;
    const occupied=[...next.ducks.map(d=>({xy:d.spawn,radius:.13})),...next.props.map(p=>({xy:p.position,radius:['target','ball'].includes(p.kind)?p.size[0]/2:Math.hypot(p.size[0],p.size[1])/2}))];
    if(occupied.some(p=>Math.hypot(point[0]-p.xy[0],point[1]-p.xy[1])<radius+p.radius+.02))throw Error('Move the placement point away from the duck or existing objects.');
  }
  const id=kind==='duck'?addSetupDuck(next):field?addSetupField(next,kind):addSetupProp(next,kind);
  if(kind==='duck')next.ducks.find(d=>d.id===id).spawn=[...point,0];
  else if(field)next.fields.find(f=>f.id===id).position=[...point];
  else{
    const prop=next.props.find(p=>p.id===id);prop.position=[...point,prop.position[2]];
    Object.assign(prop,propProfile(profile));
  }
  return {scene:validateScene({...next,version:10,presentation:{view:'ar'}}),id};
}
