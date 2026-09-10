import { defaultScene,validateScene } from './scene.js';
export const LOOM_CONDITIONS=[
  {name:'Motion pathway',visionModel:'motion-opponency-v1',mode:'brain',silence:'none'},
  {name:'Reactive motion',visionModel:'motion-opponency-v1',mode:'reflex',silence:'none'},
  {name:'LPLC2 intervention',visionModel:'motion-opponency-v1',mode:'brain',silence:'lplc2'},
  {name:'GF intervention',visionModel:'motion-opponency-v1',mode:'brain',silence:'gf'},
];
export function loomingScene(seed,family,condition,gfGain=6){
  const s=defaultScene('empty');s.seed=`loom-eval-${seed}`;s.name=`${family} · matched seed ${seed}`;
  s.ducks[0]={...s.ducks[0],...condition,gfGain};delete s.ducks[0].name;s.ducks[0].name='Duck 1';
  const sign=seed%2?1:-1,contrast=seed%2?'#ededed':'#202020';
  s.props=[{id:'threat',kind:'ball',position:family==='approach'?[1.15,(seed%5-2)*.015,.17]:[.8,sign*.6,.17],size:[.16+(seed%4)*.025,.2,.2],motion:family==='approach'?[-.25-(seed%3)*.035,0,0]:[0,sign*.12,0],color:contrast}];
  s.challenge.duration=3;s.challenge.goal=[1.5,0];return validateScene(s);
}
export async function compareLooming(runTrial,progress,{seeds=30,gfGain=6}={}){
  if(!Number.isInteger(seeds)||seeds<1||seeds>30)throw Error('Use 1–30 matched seeds');
  const rows=[];let done=0;const total=seeds*2*LOOM_CONDITIONS.length;
  for(const condition of LOOM_CONDITIONS){const trials=[];
    for(const family of ['approach','lateral-control'])for(let seed=0;seed<seeds;seed++){
      progress(`${condition.name} · ${family} · ${seed+1}/${seeds}`,done++,total);
      const result=await runTrial(loomingScene(seed,family,condition,gfGain),150,{looming:true,family});trials.push({...result,family,seed});
    }
    rows.push({condition:condition.name,trials,meanScore:trials.reduce((s,t)=>s+t.score,0)/trials.length});
  }
  return {format:'duckfly-looming-comparison',version:1,seeds,gfGain,limits:{forward:.3,yaw:.65},rows,
    calibration:'Fixed gains, no per-condition tuning. Held-out physical scenes; all outcomes retained.',
    interpretation:'Matched physical looming and lateral controls. Inspect collisions and actual stopping distance. Neural fidelity and superiority are not inferred from these scores.'};
}
export class StoppingMeasure {
  constructor(){this.intent=null;this.stopped=null;this.firstContact=null;this.maxSpeed=0;this.lastPosition=null;this.distanceAfterIntent=0;this.minSeparation=Infinity;}
  observe(state){const duck=state.body.ducks[0],cause=state.event?.causes[0],threat=state.body.props[0],time=state.body.time;
    this.maxSpeed=Math.max(this.maxSpeed,duck.speed);
    if(this.intent&&this.lastPosition&&!this.stopped)this.distanceAfterIntent+=Math.hypot(duck.position[0]-this.lastPosition[0],duck.position[1]-this.lastPosition[1]);
    this.lastPosition=[...duck.position];
    if(threat)this.minSeparation=Math.min(this.minSeparation,Math.hypot(threat.position[0]-duck.position[0],threat.position[1]-duck.position[1]));
    if(!this.intent&&cause?.command.vx===0&&this.maxSpeed>.08&&(cause.neural.event.includes('stop reflex')||cause.input.loomL+cause.input.loomR>.2))this.intent={time,position:[...duck.position]};
    if(this.intent&&!this.stopped&&!duck.fallen&&duck.speed<.025&&time-this.intent.time>.1)this.stopped={time,position:[...duck.position]};
    if(this.firstContact===null&&state.body.collisions.some(c=>c.includes('threat')))this.firstContact=time;
  }
  result(){return {stopIntentAt:this.intent?.time??null,physicallyStoppedAt:this.stopped?.time??null,stoppingDistance:this.stopped?this.distanceAfterIntent:null,residualTravel:this.distanceAfterIntent,firstContactAt:this.firstContact,minSeparation:this.minSeparation,maxSpeed:this.maxSpeed};}
}
