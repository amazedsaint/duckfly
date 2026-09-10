import { defaultScene } from '../../web/src/lab/scene.js';
import { seededRandom } from '../../web/src/brain.js';
export const FAMILIES=['incoming','parked','crossing','near-miss','receding','empty','scan','retreat'];
export function cases(split,seeds){return FAMILIES.flatMap(family=>Array.from({length:seeds},(_,index)=>{
 const id=`tv-${split}-${family}-${index}`,r=seededRandom(id),sign=index%2?1:-1;
 return {id,family,index,sign,x:1.05+r()*.2,y:(r()-.5)*.06,size:.13+r()*.09,speed:.23+r()*.08,phase:r()*Math.PI*2,shape:r()<.5?'ball':'block',color:index%2?'#e8e8e8':'#242424',pause:1.2+r()*1.4,head:.08+r()*.14,background:.58+r()*.25};
}));}
export function sceneFor(c,collection=false){
 const s=defaultScene('empty');s.seed=c.id;s.name=c.id;s.challenge.duration=5;s.challenge.goal=[1.5,0];
 Object.assign(s.ducks[0],{visionModel:'motion-opponency-v1',mode:collection||c.family==='scan'?'manual':'brain',gfGain:6});
 s.props=[{id:'bg-a',kind:'block',position:[1.4,c.background,.19],size:[.14,.16,.38],color:'#8d938d'},
 {id:'bg-b',kind:'block',position:[1.7,-c.background,.16],size:[.2,.1,.32],color:'#4d564e'}];
 let position=[c.x,c.y,.16],motion=[0,0,0];
 if(['incoming','near-miss'].includes(c.family)){motion=[-c.speed,0,0];if(c.family==='near-miss')position[1]=c.sign*(.36+Math.abs(c.y));}
 if(c.family==='parked'||c.family==='retreat')position=[.52+(c.x-1.05),c.y,.16];
 if(c.family==='receding'){position=[.48+(c.x-1.05),c.y,.16];motion=[c.speed+.15,0,0];}
 if(c.family==='crossing'){position=[.52+(c.x-1.05),c.sign*(.5+Math.abs(c.y)),.16];motion=[0,-c.sign*c.speed,0];}
 if(!['empty','scan'].includes(c.family))s.props.unshift({id:'object',kind:c.shape,position,size:[c.size,c.size,c.size],color:c.color,motion});
 return s;
}
function changeMotion(e,id,velocity){
 const p=e.world.props.find(p=>p.id===id),position=e.world.state().props.find(p=>p.id===id).position,time=e.world.d.time;
 e.moveProp(id,position,0);p.motion=[...velocity];p.position=position.map((v,i)=>v-velocity[i]*time);
}
export function events(e,c,tick){
 if(c.family==='incoming'){
  const stop=2*Math.round((c.x-.3)/c.speed/.04);
  if(tick===stop)changeMotion(e,'object',[0,0,0]);
  if(tick===Math.max(stop+26,186))changeMotion(e,'object',[.4,0,0]);
 }
 if(c.family==='retreat'&&tick===140)changeMotion(e,'object',[.42,0,0]);
}
export function configureDrive(e,c,collection=false){
 const a=e.agents.get('duck-1'),sense=a.adapter.sense.bind(a.adapter);
 a.adapter.sense=(v,d,t,...rest)=>{
  const s=sense(v,d,t,...rest);s.head=[.04*Math.sin(t*1.8+c.phase),0,(c.family==='scan'?.3:c.head)*Math.sin(t*2.2+c.phase),0];
  if(!collection&&c.family!=='scan')s.forward=.12;
  return s;
 };
}
export function collectionDrive(e,c,time){
 const pause=c.index%3===0&&time>=c.pause&&time<c.pause+1.1;
 e.scene.ducks[0].manual=c.family==='scan'||pause?[0,0]:[.3,.14*Math.sin(time*.8+c.phase)];
}
// Evaluation / supervision only. Never import this function into a decoder.
export function labelRisk(e){
 const b=e.world.state().ducks[0],heading=[Math.cos(b.heading),Math.sin(b.heading)],state=e.world.state();let risk=false,minGap=Infinity;
 for(const p of e.world.props){
  const spec=e.scene.props.find(s=>s.id===p.id),position=state.props.find(s=>s.id===p.id).position;
  const r=[position[0]-b.position[0],position[1]-b.position[1]],v=[p.motion[0]-.12*heading[0],p.motion[1]-.12*heading[1]],v2=v[0]**2+v[1]**2;
  const at=Math.max(0,Math.min(3,v2?-(r[0]*v[0]+r[1]*v[1])/v2:0)),radius=(spec.kind==='ball'?spec.size[0]/2:Math.hypot(spec.size[0],spec.size[1])/2)+.09;
  const closest=Math.hypot(r[0]+v[0]*at,r[1]+v[1]*at)-radius;minGap=Math.min(minGap,closest);
  if(r[0]*heading[0]+r[1]*heading[1]>-.03&&closest<0)risk=true;
 }
 return {risk:Number(risk),minGap,contact:state.collisionCount>0,fallen:b.fallen};
}
