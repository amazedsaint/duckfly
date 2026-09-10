// These are engineered connections from circuit outputs to existing body
// controllers. They do not alter fly anatomy or let a neuron control a joint.
export const FORWARD_OPERATIONS = Object.freeze([
  {value:'walk',label:'Walk',description:'Forward neurons ask the walking policy to move.'},
  {value:'kick',label:'Kick on sight',description:'A fresh visible cue and sustained forward activity request a kick.'},
  {value:'off',label:'No forward action',description:'Forward activity cannot start walking or an automatic kick.'},
]);
export const TURN_OPERATIONS = Object.freeze([
  {value:'follow',label:'Follow the turn',description:'Left and right neural activity turn the duck in the same direction.'},
  {value:'reverse',label:'Reverse the turn',description:'Swap the direction sent to the body to compare the response.'},
  {value:'off',label:'No turning',description:'Turn activity is visible in the brain but does not turn the body.'},
]);
const bypassModes=new Set(['manual','reactive','reflex']);
export const brainMappingEnabled=duck=>!bypassModes.has(duck.mode);

export function normalizeBrainMapping(duck){
  const value=duck.mapping;
  if(value!=null&&(typeof value!=='object'||Array.isArray(value)))throw Error('Invalid brain mapping');
  const forward=value?.forward??(duck.kickOnSight?'kick':'walk'),turn=value?.turn??'follow';
  if(!FORWARD_OPERATIONS.some(o=>o.value===forward))throw Error('Invalid forward brain operation');
  if(!TURN_OPERATIONS.some(o=>o.value===turn))throw Error('Invalid turning brain operation');
  return {forward,turn};
}

// Shared by setup previews and live engine edits. An explicit canonical mapping
// wins; an alias-only edit from an older control updates the canonical field.
export function patchBrainMapping(duck,patch){
  const next={...duck,...patch};
  if(Object.hasOwn(patch,'kickOnSight')&&!Object.hasOwn(patch,'mapping')&&duck.mapping){
    next.mapping={...normalizeBrainMapping(duck),forward:patch.kickOnSight?'kick':'walk'};
  }
  if(next.mapping!=null){next.mapping=normalizeBrainMapping(next);next.kickOnSight=next.mapping.forward==='kick';}
  return next;
}

export function brainMappingSummary(duck){
  if(!brainMappingEnabled(duck))return duck.mode==='manual'?'Manual controls bypass brain connections':'Camera rules bypass brain connections';
  const mapping=normalizeBrainMapping(duck);
  return `${FORWARD_OPERATIONS.find(o=>o.value===mapping.forward).label} · ${TURN_OPERATIONS.find(o=>o.value===mapping.turn).label}`;
}

// v1-v5 recordings keep their original kick semantics, including old bypass
// controllers. Explicit v6 wiring only routes outputs from neural controllers.
export function automaticKickEnabled(duck,sceneVersion=6){
  return normalizeBrainMapping(duck).forward==='kick'&&(sceneVersion<6||brainMappingEnabled(duck));
}

export function mapBrainCommand(command,duck,provenance){
  if(!brainMappingEnabled(duck))return command;
  const mapping=normalizeBrainMapping(duck),next={...command};
  if(mapping.forward!=='walk'){
    next.vx=0;
    if(provenance)provenance.forward=mapping.forward==='off'?'Forward connection off':'Forward neurons mapped to visual kick';
  }
  if(mapping.turn==='reverse'){
    // Multiplying an existing request cannot create a request past a stop gate.
    next.yaw=next.yaw===0?0:-next.yaw;
    if(provenance)provenance.yaw='Fly turn direction reversed';
  }else if(mapping.turn==='off'){
    next.yaw=0;
    if(provenance)provenance.yaw='Turn connection off';
  }
  return next;
}
