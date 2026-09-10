// World motion for a prop. The duck receives only the rendered result.
export function propPosition(prop, time) {
  const b=prop.behavior;
  if(!b)return prop.position.map((v,i)=>v+prop.motion[i]*time);
  const elapsed=Math.max(0,time-b.startedAt), offset=[0,0,0];
  if(b.kind==='patrol')offset[b.axis==='x'?0:1]=b.range*Math.sin(elapsed*b.speed/b.range);
  if(b.kind==='orbit'){
    const angle=elapsed*b.speed/b.range;
    offset[0]=b.range*(Math.cos(angle)-1);offset[1]=b.range*Math.sin(angle);
  }
  return prop.position.map((v,i)=>v+offset[i]);
}

export const PROP_PROFILES=[['fixed','Fixed in place'],['pushable','Pushable · light'],['heavy','Pushable · heavy'],['slippery','Pushable · slippery'],['patrol','Move back and forth'],['orbit','Move in a circle']];
export function profileFor(p){return p.behavior?.kind??(p.movable?(p.mass>=.8?'heavy':p.friction<=.1?'slippery':'pushable'):p.motion?.some(Boolean)?'existing-motion':'fixed');}
export function propProfile(profile,{speed=.2,range=.4,axis='y',time=0}={}){
  if(!PROP_PROFILES.some(([id])=>id===profile))throw Error('Unknown prop behavior');
  const moving=['patrol','orbit'].includes(profile),movable=['pushable','heavy','slippery'].includes(profile);
  return {movable,motion:[0,0,0],behavior:moving?{kind:profile,speed,range,axis,startedAt:time}:null,
    ...(movable?{mass:profile==='heavy'?1:.08,friction:profile==='slippery'?.05:.8}:{})};
}
