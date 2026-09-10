// Scenes are portable data. No executable content or arbitrary MJCF is accepted.
const kinds=new Set(['wall','block','ball','target']);
const modes=new Set(['brain','target','flock','reactive','manual','odor','light','reflex']);
const sources=new Set(['eyes','webcam']);
const adapterWeights=value=>Object.fromEntries(Object.entries({forward:.12,turn:.18,flow:.08,field:.12}).map(([key,fallback])=>[key,number(value?.[key]??fallback,0,.3,`${key} adapter weight`)]));
export const COLORS={target:'#ee4581',neighbor:'#35b9d3',wall:'#75837c',block:'#dfac5c',ball:'#6d7cec'};
const number=(v,lo,hi,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(`${label} must be between ${lo} and ${hi}`);return v;};
const id=v=>{if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,40}$/.test(v))throw Error('Invalid object ID');return v;};
const label=v=>{if(typeof v!=='string'||v.length>80)throw Error('Invalid label');return v;};
const vec=(v,n,lo,hi,name)=>{if(!Array.isArray(v)||v.length!==n)throw Error(`Invalid ${name}`);return v.map(x=>number(x,lo,hi,name));};
const choice=(v,values,name)=>{if(!values.has(v))throw Error(`Invalid ${name}`);return v;};
export function validateScene(input){
  if(!input||![1,2].includes(input.version))throw Error('Unsupported scene version');
  if(!Array.isArray(input.ducks)||input.ducks.length<1||input.ducks.length>8)throw Error('Use 1–8 ducks');
  if(!Array.isArray(input.props)||input.props.length>40)throw Error('Use at most 40 props');
  const scene={version:2,name:label(input.name??'Untitled arena'),seed:id(input.seed??'duckfly-v1'),
    ducks:input.ducks.map(d=>({id:id(d.id),name:label(d.name??d.id),spawn:vec(d.spawn,3,-10,10,'spawn'),
      mode:choice(d.mode??'target',modes,'controller'),source:choice(d.source??'eyes',sources,'camera source'),
      visionModel:choice(d.visionModel??'marker-v1',new Set(['marker-v1','motion-opponency-v1']),'vision model'),
      gfGain:number(d.gfGain??6,1,12,'GF input gain'),headStabilization:!!d.headStabilization,
      activeLook:!!d.activeLook,flowSteer:!!d.flowSteer,feedback:d.feedback!==false,
      adapter:adapterWeights(d.adapter),
      eye:choice(d.eye??'both',new Set(['both','left','right','none']),'eye covering'),
      silence:choice(d.silence??'none',new Set(['none','output','forward','left','right','loom','gf','motion','lplc2']),'intervention'),
      manual:vec(d.manual??[0,0],2,-.8,.8,'manual command')})),
    props:input.props.map(p=>({id:id(p.id),name:label(p.name??p.kind),kind:choice(p.kind,kinds,'prop'),
      position:vec(p.position,3,-10,10,'position'),size:vec(p.size??[.12,.12,.12],3,.01,2,'size'),
      yaw:number(p.yaw??0,-Math.PI,Math.PI,'rotation'),mass:number(p.mass??.08,.005,20,'mass'),
      friction:number(p.friction??.8,.05,3,'friction'),movable:!!p.movable,
      color:typeof p.color==='string'&&/^#[0-9a-f]{6}$/i.test(p.color)?p.color:COLORS[p.kind],
      motion:vec(p.motion??[0,0,0],3,-2,2,'motion')})),
    fields:(input.fields??[]).map(f=>({id:id(f.id),kind:choice(f.kind,new Set(['light','odor']),'field'),
      position:vec(f.position,2,-10,10,'field position'),strength:number(f.strength??1,0,5,'strength'),
      radius:number(f.radius??.5,.05,5,'radius')})),
    challenge:{duration:number(input.challenge?.duration??30,1,600,'duration'),
      subject:input.challenge?.subject??'ducks',
      goal:vec(input.challenge?.goal??[1,0],2,-10,10,'goal'),radius:number(input.challenge?.radius??.12,.03,2,'goal radius')}};
  if(scene.fields.length>16)throw Error('Use at most 16 sensory fields');
  const ids=[...scene.ducks,...scene.props,...scene.fields].map(x=>x.id);
  if(new Set(ids).size!==ids.length)throw Error('Object IDs must be unique');
  if(scene.challenge.subject!=='ducks'&&!scene.props.some(p=>p.id===scene.challenge.subject))throw Error('Challenge object is missing');
  for(const p of scene.props)if(p.movable&&p.motion.some(Boolean))throw Error('A prop cannot be both freely moving and animated');
  return scene;
}
export function defaultScene(preset='target'){
  const ducks=[{id:'duck-1',name:'Duck 1',spawn:[0,0,0],mode:preset==='flock'?'flock':preset==='empty'?'brain':'target'}];
  if(preset==='vision')ducks[0].visionModel='motion-opponency-v1';
  const props=preset==='empty'?[]:[{id:'target-1',kind:'target',position:[.9,0,.13],size:[.07,.07,.07]}];
  if(preset==='flock'){
    ducks[0].mode='target';
    ducks.push({id:'duck-2',name:'Duck 2',spawn:[-.35,-.15,0],mode:'flock'},{id:'duck-3',name:'Duck 3',spawn:[-.65,.15,0],mode:'flock'});
  }
  if(preset==='occlusion')props.push({id:'wall-1',kind:'wall',position:[.45,0,.17],size:[.045,.3,.34]});
  if(preset==='loom')props.push({id:'threat-1',kind:'ball',color:'#d6434a',position:[1.3,.03,.2],size:[.25,.25,.25],motion:[-.25,0,0]});
  return validateScene({version:2,name:({target:'Follow the beacon',empty:'Open arena',flock:'Follow the flock',occlusion:'Out of sight',loom:'Approaching threat',vision:'Retinal motion lab'})[preset]??'Arena',seed:'duckfly-v1',ducks,props});
}
export function encodeScene(scene){
  const json=JSON.stringify(validateScene(scene));
  return btoa(unescape(encodeURIComponent(json))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodeScene(value){
  if(typeof value!=='string'||value.length>50000)throw Error('Scene link is too large');
  try{return validateScene(JSON.parse(decodeURIComponent(escape(atob(value.replaceAll('-','+').replaceAll('_','/'))))));}
  catch(e){throw Error(`Invalid scene link: ${e.message}`);}
}
const prefix=(xml,p)=>xml.replace(/\b(name|joint|body|body1|body2|site|objname)="([^"]+)"/g,(_,key,value)=>`${key}="${p}${value}"`);
export function sceneXML(template,input){
  const scene=validateScene(input);
  const bodies=scene.ducks.map(d=>prefix(template.body,`${d.id}/`));
  for(const p of scene.props){
    const sphere=p.kind==='ball'||p.kind==='target';
    const size=sphere?p.size[0]/2:p.size.map(v=>v/2).join(' ');
    bodies.push(`<body name="prop/${p.id}" pos="${p.position.join(' ')}" euler="0 0 ${p.yaw}"${!p.movable?' mocap="true"':''}>
      ${p.movable?`<freejoint name="prop/${p.id}/joint"/>`:''}
      <geom name="prop/${p.id}/geom" type="${sphere?'sphere':'box'}" size="${size}" mass="${p.mass}" friction="${p.friction} .005 .0001" priority="1" contype="3" conaffinity="3"/>
      </body>`);
  }
  return template.common.replace('</worldbody>',bodies.join('')+'</worldbody>').replace('</mujoco>',
    `<actuator>${scene.ducks.map(d=>prefix(template.actuators,`${d.id}/`)).join('')}</actuator><sensor>${scene.ducks.map(d=>prefix(template.sensors,`${d.id}/`)).join('')}</sensor></mujoco>`);
}
