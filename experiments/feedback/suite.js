import { defaultScene } from '../../web/src/lab/scene.js';
import { seededRandom } from '../../web/src/brain.js';
export const FAMILIES=['offset','moving','reposition','occlusion'];
export function cases(split='pilot',seeds=4){return FAMILIES.flatMap(family=>Array.from({length:seeds},(_,index)=>{
 const seed=`feedback-${split}-${family}-${index}`,r=seededRandom(seed),sign=index%2?-1:1;
 return {id:seed,seed,family,index,sign,x:.72+r()*.2,y:sign*(.16+r()*.17),phase:r()*Math.PI*2,size:.06+r()*.025};
}));}
export function sceneFor(c,condition){const s=defaultScene('target');s.seed=c.seed;s.name=c.id;s.challenge.duration=6.1;
 const d=s.ducks[0];d.activeLook=condition!=='original';d.headStabilization=condition==='old-stabilization';
 s.props[0].position=[c.x,c.family==='offset'?c.y:c.y*.35,.15];s.props[0].size=[c.size,c.size,c.size];
 if(c.family==='occlusion')s.props.push({id:'wall-1',kind:'wall',position:[.45,3,.19],size:[.04,.48,.38]});
 return s;
}
export function sceneEvents(experiment,c,tick){
 const time=tick*.02;
 if(c.family==='moving'&&tick%5===0)experiment.moveProp('target-1',[c.x,.23*Math.sin(time*1.4+c.phase),.15],0);
 if(c.family==='reposition'&&tick===100)experiment.moveProp('target-1',[c.x-.18,c.sign*(.38+Math.abs(c.y)*.3),.15],0);
 if(c.family==='occlusion'&&(tick===75||tick===145))experiment.moveProp('wall-1',[.45,tick===75?0:3,.19],0);
}
export function trialMetrics(c,condition,trace,elapsed){
 const last=trace.at(-1),lastSegment=trace.filter(t=>t.time>=4),lost=trace.find(t=>t.time>=2&& !t.visible),recovered=lost?trace.find(t=>t.time>lost.time&&t.visible):null;
 return {id:c.id,family:c.family,condition,finalError:last.error,lateError:lastSegment.reduce((s,t)=>s+t.error,0)/lastSegment.length,
 visibleFraction:trace.filter(t=>t.visible).length/trace.length,recovery:c.family==='reposition'&&lost?{lostAt:lost.time,recoveredAt:recovered?.time??null}:null,
 headingError:trace.reduce((s,t)=>s+Math.abs(t.headingError),0)/trace.length,fallen:trace.some(t=>t.fallen),contacts:last.contacts,
 distance:last.distance,unsafeForward:trace.filter(t=>(!t.visible||!t.fresh)&&t.command[0]>0).length,elapsedMs:elapsed,trace};
}
