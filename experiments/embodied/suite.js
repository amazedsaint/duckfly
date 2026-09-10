import {defaultScene} from '../../web/src/lab/scene.js';
import {seededRandom} from '../../web/src/brain.js';
export const FAMILIES=['fixed','moving','occlusion','reposition','blocked','slippery'];
export function cases(split,seeds){return FAMILIES.flatMap(family=>Array.from({length:seeds},(_,index)=>{
 const id=`embodied-v1-${split}-${family}-${index}`,r=seededRandom(id),sign=index%2?-1:1;
 return {id,family,index,sign,x:.8+r()*.18,y:sign*(.13+r()*.14),phase:r()*Math.PI*2,size:.08+r()*.03};
}));}
export function sceneFor(c,condition){
 const s=defaultScene('target');s.name=c.id;s.seed=c.id;s.ducks[0].activeLook=['scan','memory','wrong-memory'].includes(condition);
 s.props[0].position=[c.x,c.y,.14];s.props[0].size=[c.size,c.size,c.size];
 if(c.family==='occlusion')s.props.push({id:'wall',kind:'wall',position:[.45,2,.17],size:[.06,.4,.34]});
 if(c.family==='blocked')s.props.push({id:'obstacle',kind:'block',position:[.35,c.y*.3,.035],size:[.1,.4,.07]});
 return s;
}
export function events(e,c,tick){
 if(c.family==='moving'&&tick%5===0)e.moveProp('target-1',[c.x,c.y+.25*Math.sin(tick*.02*1.1+c.phase),.14],0);
 if(c.family==='reposition'&&tick===110)e.moveProp('target-1',[c.x-.05,c.sign*.45,.14],0);
 if(c.family==='occlusion'&&(tick===75||tick===140))e.moveProp('wall',[.45,tick===75?c.y*.5:2,.17],0);
 if(c.family==='slippery'&&tick===90){
  for(const geom of [e.world.robots[0].c.floor,...e.world.robots[0].c.feet])e.world.m.geom_friction[geom*3]=.08;
  e.world.robots[0].pushTicks=10;e.world.robots[0].pushForce=1.5;
 }
}
export function summarize(c,condition,trace,elapsedMs){
 const last=trace.at(-1),late=trace.filter(t=>t.time>=5),from=c.family==='occlusion'?2.8:2.2;
 const lost=trace.find(t=>t.time>=from&&!t.visible),recovered=lost?trace.find(t=>t.time>lost.time&&t.visible):null;
 return {id:c.id,family:c.family,condition,lateError:late.reduce((s,t)=>s+t.error,0)/late.length,finalError:last.error,
 progress:trace[0].error-last.error,fallen:trace.some(t=>t.fallen),contacts:last.contacts,
 commandVariation:trace.slice(1).reduce((s,t,i)=>s+Math.abs(t.command[0]-trace[i].command[0]),0),
 turnVariation:trace.slice(1).reduce((s,t,i)=>s+Math.abs(t.command[1]-trace[i].command[1]),0),
 visibleFraction:trace.filter(t=>t.visible).length/trace.length,reacquisition:lost?(recovered?recovered.time-lost.time:8-lost.time):0,
 unsafeForward:trace.filter(t=>(!t.visible||!t.fresh)&&t.command[0]>1e-9).length,
 peakTilt:Math.max(...trace.map(t=>t.tilt)),elapsedMs,trace};
}
