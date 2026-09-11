import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Brain} from '../../web/src/brain.js';
const source=new URL('../../shared/assets/Brain/circuit.json',import.meta.url),bytes=fs.readFileSync(source),circuit=JSON.parse(bytes);
const rows=[];
for(const seed of ['air-causal','air-control-2','air-control-3','senses-v1/duck-1'])for(const strength of [0,.2,.5,.8,1]){
  const active=new Brain(circuit,seed),cut=new Brain(circuit,seed);
  for(const index of cut.sim.sens)cut.sim.silencedNeurons[index]=1;
  const held=[0,0],first=[null,null];
  for(let tick=0;tick<100;tick++)for(const [index,brain] of [active,cut].entries()){
    const value=brain.step(null,{forward:.12,air:tick>=25&&tick<45?strength:0});
    if(value.gfHeld){held[index]++;first[index]??=tick;}
  }
  rows.push({seed,strength,heldTicks:held[0],sensoryCellsSilencedHeldTicks:held[1],firstHeldTick:first[0]});
}
console.log(JSON.stringify({format:'duckfly-air-pathway-probe',circuitSha256:createHash('sha256').update(bytes).digest('hex'),brainSourceSha256:createHash('sha256').update(fs.readFileSync(new URL('../../web/src/brain.js',import.meta.url))).digest('hex'),conditions:{ticks:100,tickSeconds:.02,pulseTicks:[25,45],forwardCurrent:.12,gfGain:6,feedback:false,cameraInput:false,sensoryCells:16},rows},null,2));
