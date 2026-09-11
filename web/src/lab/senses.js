// Local sensor measurements. Scent is a modeled concentration field, not an
// olfactory connectome. Air uses DesktopFly's existing sensory-current input.
export const DEFAULT_SENSES = Object.freeze({antennae:'both',air:true,touch:true});
export const SENSOR_TRIGGERS = new Set(['scent','scent-left','scent-right','scent-lost','air','contact']);
export const FIELD_LABELS = Object.freeze({odor:'Scent source',air:'Air current',light:'Light source'});
export const FIELD_COLORS = Object.freeze({odor:'#ae80d7',air:'#65cbd1',light:'#edc968'});

export function normalizeSenses(value = DEFAULT_SENSES) {
  if(!value || typeof value!=='object' || Array.isArray(value) ||
      !['both','left','right','none'].includes(value.antennae??'both') ||
      ['air','touch'].some(key=>value[key]!=null&&typeof value[key]!=='boolean')) throw Error('Invalid sensory settings');
  return {antennae:value.antennae??'both',air:value.air!==false,touch:value.touch!==false};
}

export function sampleFields(fields, body) {
  const samples={odor:[0,0],light:[0,0],air:[0,0]};
  const q=body.headPose?.slice(3), heading=q?Math.atan2(2*(q[0]*q[3]+q[1]*q[2]),1-2*(q[2]**2+q[3]**2)):body.heading;
  for(let side=0;side<2;side++){
    const theta=heading+(side===0?1:-1)*Math.PI/2;
    const x=body.cameraPose[0]+Math.cos(theta)*.025,y=body.cameraPose[1]+Math.sin(theta)*.025;
    for(const field of fields){
      const distance2=(x-field.position[0])**2+(y-field.position[1])**2;
      samples[field.kind][side]+=field.strength*Math.exp(-distance2/(2*field.radius**2));
    }
  }
  return samples;
}

export function senseEnvironment(scene, duck, body, state) {
  const config=normalizeSenses(duck.senses),fields=sampleFields(scene.fields,body);
  const odor=fields.odor.map((value,side)=>config.antennae==='none'||config.antennae===(side===0?'right':'left')?0:value);
  const total=odor[0]+odor[1],strength=Math.min(1,total/2),detected=strength>=.02;
  const contrast=detected?Math.max(-1,Math.min(1,(odor[0]-odor[1])/Math.max(.04,total))):0;
  const objects=config.touch?state.collisions.flatMap(pair=>{
    const ids=pair.split('|');return ids.includes(duck.id)?ids.filter(id=>id!==duck.id&&id!=='floor'):[];
  }):[];
  return {
    model:'duckfly-sensors-v1',time:state.time,
    scent:{available:config.antennae!=='none',antennae:config.antennae,left:Math.min(1,odor[0]),right:Math.min(1,odor[1]),strength,contrast,detected},
    air:{available:config.air,strength:config.air?Math.min(1,(fields.air[0]+fields.air[1])/2):0},
    touch:{available:config.touch,active:objects.length>0,objects:[...new Set(objects)]},
  };
}

export function sensorBlock(trigger,input) {
  if(!SENSOR_TRIGGERS.has(trigger))return null;
  const sensor=trigger.startsWith('scent')?'scent':trigger==='contact'?'touch':'air';
  return input.senses?.[sensor]?.available?null:({scent:'Scent sensors off',touch:'Touch sensor off',air:'Air sensor off'}[sensor]);
}
