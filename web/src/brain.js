import { LIFSim, SpikeBus } from './vendor/desktop-fly/sim.js';
import { clamp } from './bam.js';

export function seededRandom(label) {
  let state = 2166136261;
  for (const ch of label) state = Math.imul(state ^ ch.charCodeAt(0), 16777619) >>> 0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  random.getState=()=>state;
  random.setState=value=>{if(!Number.isInteger(value)||value<0||value>4294967295)throw Error('Invalid random state');state=value;};
  return random;
}
const simStateFields=['v','refr','silencedNeurons','inhQueue','qHead','baseline','ascendPhase','cordSourceRates',
  'loomL','loomR','gaitDrive','gaitPhase','airPuff','activityScale','sensoryGate',
  'rateLoom','rateDNaL','rateDNaR','rateMDN','rateFwd','rateGroom','rateEscW','ratePop',
  'gfLatch','simMs','totalSpikes','burstUntil','burstNext','pendingStims','activeStims'];
const plain=value=>ArrayBuffer.isView(value)?Array.from(value):Array.isArray(value)?value.map(plain):
  value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,plain(v)])):value;
function restoreValue(existing,value){
  if(ArrayBuffer.isView(existing)){if(value.length!==existing.length)throw Error('Invalid neural checkpoint shape');existing.set(value);return existing;}
  if(Array.isArray(existing)&&existing.some(ArrayBuffer.isView))return existing.map((v,i)=>restoreValue(v,value[i]));
  return structuredClone(value);
}
export class Brain {
  constructor(circuit,seed='duckfly-v1') { this.circuit=circuit;this.seed=seed; this.silenced=false; this.feedback=true; this.reset(); }
  reset() {
    this.bus=new SpikeBus();
    this.random=seededRandom(this.seed);
    this.sim=new LIFSim(this.circuit,this.bus,null,this.random);
    this.baseline=0; this.walking=false; this.escapeUntil=0; this.loomUntil=0;
    this.event='Circuit reset'; this.eventUntil=1200;
  }
  stimulate(kind) {
    const s=this.sim;
    if(kind==='walk') { s.stimulate(s.fwd,.12,3000); this.event='DNp09 · walk stimulus'; }
    if(kind==='left'||kind==='right') { s.stimulate(kind==='left'?s.dnaL:s.dnaR,.12,1500); this.event=`DNa ${kind} · turn stimulus`; }
    if(kind==='backward') { s.stimulate(s.mdn,.12,1500); this.event='MDN · retreat stimulus'; }
    if(kind==='loom') { this.loomUntil=s.simMs+400; this.event='Loom · visual stimulus'; }
    this.eventUntil=s.simMs+3200;
  }
  intervene(group){
    this.silenced=group==='output';const s=this.sim;s.silencedNeurons.fill(0);
    const indices={forward:s.fwd,left:s.dnaL,right:s.dnaR,loom:[...s.loomLeft,...s.loomRight],gf:s.gf,lplc2:[...s.loomLeft,...s.loomRight].filter(i=>s.roles[i]==='lplc2')}[group]??[];
    for(const i of indices)s.silencedNeurons[i]=1;
  }
  step(body,sensory={}) {
    const s=this.sim;
    s.gaitDrive=this.feedback&&body?Math.min(1,body.speed/.2):0;
    s.gaitPhase=this.feedback&&body?body.phase:0;
    s.loomPathway=s.simMs<this.loomUntil?'both':sensory.loomPathway??'both';
    s.loomL=Math.max(s.simMs<this.loomUntil?1:0,clamp(sensory.loomL??0,0,1));
    s.loomR=Math.max(s.simMs<this.loomUntil?1:0,clamp(sensory.loomR??0,0,1));
    if(sensory.forward>0)s.stimulate(s.fwd,clamp(sensory.forward,0,.25),20);
    if(sensory.turn>0)s.stimulate(s.dnaL,clamp(sensory.turn,0,.25),20);
    if(sensory.turn<0)s.stimulate(s.dnaR,clamp(-sensory.turn,0,.25),20);
    s.step(20);
    if(s.consumeGF()) {this.escapeUntil=s.simMs+1000;this.event='Giant Fiber · stop reflex';this.eventUntil=this.escapeUntil;}
    const difference=s.rateDNaL-s.rateDNaR;
    this.baseline+=(difference-this.baseline)*.0025;
    if(s.rateFwd>6) this.walking=true;
    if(s.rateFwd<2) this.walking=false;
    const stopped=s.simMs<this.escapeUntil||this.silenced;
    const vx=this.walking&&!stopped?.3:0;
    const yaw=stopped?0:clamp((difference-this.baseline)*.04,-.65,.65);
    if(s.simMs>this.eventUntil) this.event=this.silenced?'Output silenced':this.walking?'Neural walking drive':'Circuit at rest';
    return {neuralTime:s.simMs/1000,forward:s.rateFwd,left:s.rateDNaL,right:s.rateDNaR,loom:s.rateLoom,backward:s.rateMDN,population:s.ratePop,
      spikeCount:s.totalSpikes,fired:this.bus.popAll().map(e=>e.neuron),vx,yaw,event:this.event,
      gfHeld:s.simMs<this.escapeUntil,feedback:{enabled:this.feedback,drive:s.gaitDrive,phase:s.gaitPhase}};
  }
  checkpoint(){
    const adapter=Object.fromEntries(['seed','silenced','feedback','baseline','walking','escapeUntil','loomUntil','event','eventUntil'].map(key=>[key,this[key]]));
    return {version:1,adapter,gfGain:this.sim.gfGain,loomPathway:this.sim.loomPathway,random:this.random.getState(),events:plain(this.bus.events),sim:Object.fromEntries(simStateFields.map(key=>[key,plain(this.sim[key])]))};
  }
  restore(state){
    if(state.version!==1)throw Error('Unsupported neural checkpoint');
    for(const key of ['seed','silenced','feedback','baseline','walking','escapeUntil','loomUntil','event','eventUntil'])this[key]=state.adapter[key];
    this.sim.setGFGain(state.gfGain??6);this.sim.loomPathway=state.loomPathway??'both';
    this.random.setState(state.random);
    for(const key of simStateFields){if(!(key in state.sim))throw Error(`Neural checkpoint missing ${key}`);this.sim[key]=restoreValue(this.sim[key],state.sim[key]);}
    this.bus.events=structuredClone(state.events);
  }
}
