import { defaultScene } from './scene.js';
import { DEFAULT_WEIGHTS } from './vision.js';

// Training and held-out target placements are fixed before search begins.
// Scores use physical positions only for evaluation, never as sensory input.
export const TRAIN_CASES=[{seed:'train-left',target:[.65,.12,.18]},{seed:'train-right',target:[.65,-.12,.18]}];
export const HELD_OUT_CASES=[{seed:'eval-left',target:[.8,.23,.16]},{seed:'eval-right',target:[.8,-.23,.16]}];
export function benchmarkScene(testCase,mode='target',weights=DEFAULT_WEIGHTS,intervention='none'){
  const s=defaultScene('target');s.seed=testCase.seed;s.name=`Target trial · ${testCase.seed}`;
  s.ducks[0].mode=mode;s.ducks[0].adapter={...weights};s.ducks[0].silence=intervention;
  s.props[0].position=[...testCase.target];s.challenge.goal=testCase.target.slice(0,2);s.challenge.radius=.2;
  return s;
}
export function trialScore(scene,final,turnEffort=0){
  const duck=final.body.ducks[0],goal=scene.challenge.goal,initial=Math.hypot(goal[0],goal[1]);
  const remaining=Math.hypot(goal[0]-duck.position[0],goal[1]-duck.position[1]);
  return {seed:scene.seed,score:(initial-remaining)/initial-(duck.fallen?1:0)-final.body.collisionCount*.025-turnEffort*.00002,
    remaining,progress:initial-remaining,fallen:duck.fallen,contacts:final.body.collisionCount,distance:duck.distance,time:final.body.time,
    reachedAt:final.scores[duck.id]?.reachedAt??null};
}
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
export function promotionDecision(baseline,candidate){
  if(baseline.length!==candidate.length||baseline.length<2||baseline.some((v,i)=>v.seed!==candidate[i].seed))throw Error('Evaluation trials are not matched');
  const improvements=candidate.map((v,i)=>v.score-baseline[i].score);
  const gain=mean(improvements),noExtraFalls=candidate.every((v,i)=>!v.fallen||baseline[i].fallen);
  return {promote:gain>.02&&Math.min(...improvements)>=-.08&&noExtraFalls,meanGain:gain,
    worstCaseGain:Math.min(...improvements),noExtraFalls,threshold:.02};
}
export async function compareControllers(runTrial,progress,intervention='gf',weights=DEFAULT_WEIGHTS){
  const rows=[];let index=0;
  for(const [condition,mode,silence] of [['Fly circuit','target','none'],['Reactive controller','reactive','none'],[`Silence ${intervention}`,'target',intervention]]){
    const trials=[];
    for(const c of HELD_OUT_CASES){progress(`${condition} · ${c.seed}`,index++,6);trials.push(await runTrial(benchmarkScene(c,mode,weights,silence),300));}
    rows.push({condition,trials,meanScore:mean(trials.map(t=>t.score))});
  }
  return {format:'duckfly-comparison',version:1,task:'Six-second camera target approach',rows,
    interpretation:'Matched seeds and placements in separate physical arenas. These bounded trials do not establish biological validity.'};
}
export async function learnAdapter(runTrial,progress,initial=DEFAULT_WEIGHTS){
  const candidates=[{...initial},{...initial,turn:.08},{...initial,turn:.03},
    {...initial,forward:.08,turn:.06},{...initial,forward:.16,turn:.08}];
  const training=[];let index=0;
  for(const weights of candidates){const trials=[];
    for(const c of TRAIN_CASES){progress(`Training candidate ${training.length+1} · ${c.seed}`,index++,14);trials.push(await runTrial(benchmarkScene(c,'target',weights),240));}
    training.push({weights,trials,meanScore:mean(trials.map(t=>t.score))});
  }
  const best=training.reduce((a,b)=>b.meanScore>a.meanScore?b:a),baseline=[],candidate=[];
  for(const c of HELD_OUT_CASES){
    progress(`Held-out baseline · ${c.seed}`,index++,14);baseline.push(await runTrial(benchmarkScene(c,'target',initial),300));
    progress(`Held-out candidate · ${c.seed}`,index++,14);candidate.push(await runTrial(benchmarkScene(c,'target',best.weights),300));
  }
  const gate=promotionDecision(baseline,candidate);
  return {format:'duckfly-adapter',version:1,method:'Finite parameter search through camera and physical simulation',
    weights:gate.promote?best.weights:{...initial},candidateWeights:best.weights,training,evaluation:{baseline,candidate},gate,
    interpretation:gate.promote?'Candidate passed this held-out evaluation. Broader performance remains untested.':'No promotion. Original weights retained.'};
}
