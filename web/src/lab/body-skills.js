// Engineered skill selection. These policies control the Microduck body; the
// fly circuit supplies a trigger, not the joint actions or the learned balance.
export class BodySkills {
  constructor(){this.reset();}
  reset(){this.phase='walk';this.source='manual';this.ticks=0;this.stable=0;this.visualTicks=0;this.armed=true;this.message='Walking policy';}
  request(kind,body){
    if(!['kick','recover'].includes(kind))throw Error('Unknown body skill');
    if(this.phase!=='walk')return false;
    if(kind==='kick'&&body.fallen){this.message='Recover before kicking';return false;}
    if(kind==='recover'&&!body.fallen){this.message='Duck is already upright';return false;}
    this.source='manual';this.phase=kind==='kick'?'settle':'recover';this.ticks=0;this.stable=0;this.message=kind==='kick'?'Waiting for a steady stance':'Standing policy is attempting recovery';return true;
  }
  step(body,neural,input,{enabled=true,kickOnSight=false}={}){
    if(!enabled||neural.gfHeld){
      if(this.phase!=='walk'){this.phase='walk';this.ticks=0;this.stable=0;this.message='Skill cancelled by body-output or stop gate';}
      this.visualTicks=0;this.armed=false;return {policy:'walking',active:false};
    }
    const visible=input.fresh&&input.targetVisible;
    if(this.source==='vision'&&['settle','kick'].includes(this.phase)&&!visible){this.phase='walk';this.message='Visual kick cancelled: cue is no longer visible';this.visualTicks=0;}
    if(input.fresh&&!input.targetVisible){this.armed=true;this.visualTicks=0;}
    if(this.phase==='walk'&&kickOnSight&&this.armed&&visible&&neural.forward>=6){
      if(++this.visualTicks>=5){this.request('kick',body);this.source='vision';this.armed=false;this.visualTicks=0;}
    }else if(!visible||!kickOnSight||neural.forward<6)this.visualTicks=0;
    if(this.phase==='walk')return {policy:'walking',active:false};
    this.ticks++;
    const steady=body.tilt<12&&body.position[2]>.09&&body.speed<.04;
    this.stable=steady?this.stable+1:0;
    if(this.phase==='settle'){
      if(body.fallen){this.phase='walk';this.message='Kick cancelled: duck fell';return {policy:'walking',active:false};}
      if(this.stable>=30){this.phase='kick';this.ticks=0;this.stable=0;this.message='Left kick policy · 0.5 seconds';}
      else if(this.ticks>=200){this.phase='walk';this.message='Kick cancelled: stance did not settle';return {policy:'walking',active:false};}
    }else if(this.phase==='kick'&&this.ticks>=25){this.phase='rest';this.ticks=0;this.message='Returning to the walking policy';}
    else if(this.phase==='rest'&&this.ticks>=100){this.phase='walk';this.message='Kick finished';}
    else if(this.phase==='recover'){
      if(this.stable>=50){this.phase='walk';this.message='Upright for one second · recovery complete';return {policy:'walking',active:true,clearFall:true};}
      if(this.ticks>=400){this.phase='walk';this.message='Recovery timed out · try moving nearby props';}
    }
    return {policy:this.phase==='kick'?'kick':this.phase==='recover'?'standing':'walking',active:true};
  }
  checkpoint(){return {phase:this.phase,source:this.source,ticks:this.ticks,stable:this.stable,visualTicks:this.visualTicks,armed:this.armed,message:this.message};}
  restore(s){
    if(!s){this.reset();return;}
    if(!['walk','settle','kick','rest','recover'].includes(s.phase)||!['manual','vision'].includes(s.source)||!['ticks','stable','visualTicks'].every(k=>Number.isInteger(s[k])&&s[k]>=0&&s[k]<=400)||typeof s.armed!=='boolean'||typeof s.message!=='string'||s.message.length>150)throw Error('Invalid body-skill checkpoint');
    Object.assign(this,s);
  }
}
