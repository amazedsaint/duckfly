// User-authored functional connections, not anatomical synapses. Each signal
// keeps its measured source; the body policy still owns every joint action.
export const TRIGGERS = Object.freeze([
  {id:'forward',label:'Walking activity · DNp09',description:'Firing rate of the circuit’s walking pathway.',source:'Fly circuit',unit:'Hz',threshold:6,max:200,read:n=>n.neural.forward},
  {id:'left',label:'Left steering · DNa',description:'How much left-turn activity exceeds right-turn activity.',source:'Fly circuit',unit:'Hz difference',threshold:6,max:200,read:n=>n.neural.left-n.neural.right},
  {id:'right',label:'Right steering · DNa',description:'How much right-turn activity exceeds left-turn activity.',source:'Fly circuit',unit:'Hz difference',threshold:6,max:200,read:n=>n.neural.right-n.neural.left},
  {id:'gf',label:'Stop reflex · Giant fiber',description:'Active while the circuit’s stop reflex holds movement. This hold overrides mapped actions.',source:'Fly circuit',unit:'on/off',threshold:1,max:1,read:n=>Number(n.neural.gfHeld)},
  {id:'mdn',label:'Retreat activity · MDN',description:'Firing rate of the retreat pathway. The duck has no backward-walking action.',source:'Fly circuit',unit:'Hz',threshold:6,max:200,read:n=>n.neural.backward},
  {id:'loom',label:'Approach response · Loom',description:'Firing rate of the circuit’s looming pathway, which responds to approach-related input.',source:'Fly circuit',unit:'Hz',threshold:6,max:200,read:n=>n.neural.loom},
  {id:'seen',label:'Beacon visible',description:'Active when the camera detects a pink beacon.',source:'Camera rule',unit:'on/off',threshold:1,max:1,read:n=>Number(n.vision?.target?.visible)},
  {id:'lost',label:'Beacon out of view',description:'Active when the camera cannot detect a pink beacon.',source:'Camera rule',unit:'on/off',threshold:1,max:1,read:n=>Number(!n.vision?.target?.visible)},
  {id:'cue-left',label:'Beacon on the left',description:'How far a visible beacon is to the left in the camera image.',source:'Camera rule',unit:'image bearing',threshold:.15,max:1,read:n=>n.vision?.target?.visible?Math.max(0,n.vision.target.bearing):0},
  {id:'cue-right',label:'Beacon on the right',description:'How far a visible beacon is to the right in the camera image.',source:'Camera rule',unit:'image bearing',threshold:.15,max:1,read:n=>n.vision?.target?.visible?Math.max(0,-n.vision.target.bearing):0},
  {id:'expansion',label:'Visual expansion',description:'The vision adapter’s estimate of objects growing in the image.',source:'Vision adapter',unit:'model response',threshold:.2,max:1,read:n=>Math.max(n.input.loomL??0,n.input.loomR??0)},
  {id:'bright',label:'Bright image',description:'Average image brightness, from 0 (dark) to 1 (bright).',source:'Camera rule',unit:'brightness',threshold:.6,max:1,read:n=>(n.vision?.brightness??[0,0]).reduce((a,b)=>a+b,0)/2},
  {id:'fallen',label:'Duck has fallen',description:'Active when the body reports a fall. Only the standing action can run in this state.',source:'Body feedback',unit:'on/off',threshold:1,max:1,read:n=>Number(n.body.fallen)},
]);
export const ACTIONS = Object.freeze([
  {id:'walk',label:'Walk forward',description:'Request forward movement at up to 0.3 m/s. Actual speed depends on the body response.'},
  {id:'stop',label:'Pause movement',description:'Pause walking and turning. The body may take a moment to settle.'},
  {id:'left',label:'Arc left',description:'Walk forward while steering left. Strength adjusts the turn.'},
  {id:'right',label:'Arc right',description:'Walk forward while steering right. Strength adjusts the turn.'},
  {id:'steer',label:'Follow neural steering',description:'Turn in the direction requested by the DNa steering neurons.'},
  {id:'look-left',label:'Look left',description:'Turn the head left, within the robot’s joint limits.'},
  {id:'look-right',label:'Look right',description:'Turn the head right, within the robot’s joint limits.'},
  {id:'look-cue',label:'Look at the beacon',description:'Track a visible pink beacon with the head. Wait when it leaves view.'},
  {id:'kick',label:'Kick',description:'Wait for a steady stance, then kick once per activation.'},
  {id:'recover',label:'Stand up',description:'Attempt to stand after a fall. This action is available only when the duck has fallen.'},
]);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function newConnection(trigger='forward',action='walk',id='connection-1') {
  return {id,trigger,action,threshold:TRIGGERS.find(t=>t.id===trigger).threshold,strength:1,hold:0,enabled:true};
}
export function normalizeConnections(value) {
  if(value==null)return null;
  if(typeof value!=='object'||Array.isArray(value)||typeof value.enabled!=='boolean'||!Array.isArray(value.rules)||value.rules.length>12)throw Error('Invalid trigger connections');
  const ids=new Set();
  return {enabled:value.enabled,rules:value.rules.map(rule=>{
    const trigger=TRIGGERS.find(t=>t.id===rule.trigger);
    if(!trigger||!ACTIONS.some(a=>a.id===rule.action)||typeof rule.id!=='string'||!/^[-a-zA-Z0-9_]{1,40}$/.test(rule.id)||ids.has(rule.id)||typeof rule.enabled!=='boolean')throw Error('Invalid trigger connection');
    ids.add(rule.id);
    for(const [key,min,max] of [['threshold',.001,trigger.max],['strength',0,1],['hold',0,3]])if(typeof rule[key]!=='number'||!Number.isFinite(rule[key])||rule[key]<min||rule[key]>max)throw Error('Invalid connection '+key);
    return {id:rule.id,trigger:rule.trigger,action:rule.action,threshold:rule.threshold,strength:rule.strength,hold:rule.hold,enabled:rule.enabled};
  })};
}
export const connectionSummary=value=>value?.enabled?`${value.rules.filter(r=>r.enabled).length} custom connections · holds still between signals`:null;

export class TriggerActions {
  constructor(){this.reset();}
  reset(){this.states=Object.create(null);}
  checkpoint(){return structuredClone(this.states);}
  restore(value={}){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>12)throw Error('Invalid connection state');
    for(const [key,state] of Object.entries(value))if(!/^[-a-zA-Z0-9_]{1,40}$/.test(key)||!state||typeof state.key!=='string'||state.key.length>250||typeof state.active!=='boolean'||!Number.isFinite(state.until))throw Error('Invalid connection state');
    this.states=structuredClone(value);
  }
  step(config,context) {
    const {neural,input,body,time,duck}=context;
    if(!config?.enabled)return null;
    const requests=[],signals=[],next=Object.create(null),command={vx:0,yaw:0,head:[0,0,0,0]};
    let pause=false,skill=null;
    const gate=!duck.motorEnabled||duck.motorGain===0?'Body disconnected':duck.silence==='output'?'Output silenced':!input.fresh?'Camera stale or absent':neural.gfHeld?'Giant-fiber stop':null;
    for(const rule of config.rules){
      const trigger=TRIGGERS.find(t=>t.id===rule.trigger),value=trigger.read(context),key=JSON.stringify(rule),previous=this.states[rule.id];
      const matched=rule.enabled&&Number.isFinite(value)&&value>=rule.threshold;
      const blocked=gate||(body.fallen&&rule.action!=='recover'?'Body has fallen':null);
      const until=blocked||!rule.enabled?time:matched?time+rule.hold:previous?.key===key?previous.until:time;
      const active=!blocked&&rule.enabled&&(matched||time<until);
      const rising=active&&!(previous?.key===key&&previous.active);
      next[rule.id]={key,until,active};
      const record={id:rule.id,trigger:rule.trigger,source:trigger.source,action:rule.action,value:Number.isFinite(value)?value:null,threshold:rule.threshold,matched,active,blocked};
      signals.push(record);
      if(!active)continue;
      requests.push(record);
      if(rule.action==='stop')pause=true;
      if(rule.action==='walk'){
        if(input.gate){record.blocked=input.gateReason;continue;}
        command.vx=Math.max(command.vx,.3*rule.strength);
      }
      if(['left','right'].includes(rule.action)){
        command.yaw+=(rule.action==='left'?1:-1)*.65*rule.strength;
        if(!input.gate)command.vx=Math.max(command.vx,rule.strength>0?.3:0);
        else record.limited='Forward held: '+input.gateReason;
      }
      if(rule.action==='steer')command.yaw+=neural.yaw*rule.strength;
      if(rule.action==='look-left')command.head[2]+=.35*rule.strength;
      if(rule.action==='look-right')command.head[2]-=.35*rule.strength;
      if(rule.action==='look-cue'){
        if(context.vision?.target?.visible)command.head[2]+=clamp(context.vision.target.bearing*.3,-.35,.35)*rule.strength;
        else record.blocked='Pink cue is not visible';
      }
      if(rising&&rule.strength>0&&['kick','recover'].includes(rule.action)&&!skill)skill={kind:rule.action,connection:rule.id};
    }
    this.states=next;
    command.yaw=clamp(command.yaw,-.65,.65);command.head[2]=clamp(command.head[2],-.35,.35);
    if(pause){command.vx=0;command.yaw=0;skill=null;}
    return {command,signals,requests,skill,paused:pause,gate,idle:requests.length===0,model:'duckfly-trigger-actions-v1'};
  }
}
