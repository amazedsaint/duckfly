import fs from 'node:fs';
import { VisualSystem } from '../../web/src/lab/visual-system.js';
import { Brain } from '../../web/src/brain.js';
import { stimulusMovie,STIMULI } from '../../shared/vision/stimuli.js';
const circuit=JSON.parse(fs.readFileSync(new URL('../../shared/assets/Brain/circuit.json',import.meta.url)));
const trials=[];const seeds=30;
// Fixed thresholds and parameter distribution; retain every run, including misses.
for(const stimulus of STIMULI)for(let seed=0;seed<seeds;seed++){
  const encoder=new VisualSystem(),duck={visionModel:'motion-opponency-v1',source:'eyes',eye:'both',silence:'none'};
  let peak=0;const trace=[];
  for(const p of stimulusMovie(stimulus,{seed,contrast:.25+(seed%6)*.12,bearing:(seed%5-2)*6,speed:10+(seed%4)*3})){
    const v=encoder.encode(p,p.simulationTime,duck);peak=Math.max(peak,v.loomL,v.loomR);trace.push([p.captureTime,v.loomL,v.loomR]);
  }
  trials.push({stimulus,seed,peak,expected:stimulus.startsWith('expand'),detected:peak>.2,trace});
}
const gainSweep=[];
for(const gain of [1,2,4,6,8,10,12])for(let seed=0;seed<30;seed++){
  const brain=new Brain(circuit,`gain-${seed}`);brain.sim.setGFGain(gain);let stopAt=null;
  for(let tick=0;tick<100;tick++){const n=brain.step(null,{loomL:1,loomR:1,loomPathway:'lplc2'});if(stopAt===null&&n.event.includes('stop reflex'))stopAt=tick*.02;}
  gainSweep.push({gain,seed,stopAt});
}
function wilson(success,n){const z=1.96,p=success/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [c-h,c+h];}
const families=STIMULI.map(stimulus=>{const ts=trials.filter(t=>t.stimulus===stimulus),correct=ts.filter(t=>t.expected===t.detected).length;return {stimulus,n:ts.length,correct,accuracy:correct/ts.length,accuracyCI95:wilson(correct,ts.length)};});
const report={gainAcceptance:{range:[4,6,8],minimumStopFraction:.9,role:'Engineering sensitivity screen around existing gain; not a physiological hypothesis test'},format:'duckfly-vision-validation',version:1,model:'motion-opponency-v1',seeds,families,gainSweep,trials,
  gates:{syntheticMotion:families.every(f=>f.accuracy>=.9),gfBridgeRobust:[4,6,8].every(gain=>gainSweep.filter(g=>g.gain===gain&&g.stopAt!==null).length/30>=.9),physiology:false,physicalStopping:false},
  interpretation:'Synthetic image discrimination and direct-current sensitivity only. No physiological fidelity or closed-loop improvement is established.'};
fs.mkdirSync(new URL('./reports/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./reports/motion-baseline.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({families,gates:report.gates,gainSweep:[1,2,4,6,8,10,12].map(gain=>({gain,stops:gainSweep.filter(g=>g.gain===gain&&g.stopAt!==null).length,n:30}))},null,2));
