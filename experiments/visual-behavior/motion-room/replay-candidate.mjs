import fs from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPackagedFlyvis} from '../load-model.mjs';
import {coordinatePermutation} from '../../../shared/vision/retina.js';
import {createNeuralMapFlow as createOriginalFlow} from '../../../shared/vision/readouts/neural-map-flow.js';
import {createNeuralMapFlow as createCandidateFlow} from '../../../shared/vision/readouts/neural-map-flow-v2.js';
import {fitRidge,predict,scoreDecoder} from './decoders.js';

const root=new URL('../../../',import.meta.url),reports=new URL('./reports/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=p=>fs.readFileSync(new URL(p,root));
const decode=value=>new Float32Array(Uint8Array.from(Buffer.from(value,'base64')).buffer);
const encode=value=>Buffer.from(new Float32Array(value).buffer).toString('base64');
const mean=values=>values.reduce((sum,v)=>sum+v,0)/Math.max(1,values.length);
const wrap=value=>Math.atan2(Math.sin(value),Math.cos(value));
const run=process.argv[2]??'aperture-v2-replay-diagnostic-1';
if(!/^[a-z0-9-]{1,70}$/.test(run))throw Error('Invalid replay name');
const calibrationPath='experiments/visual-behavior/motion-room/reports/motion-calibration-v2.json.gz';
const physicalPath='experiments/visual-behavior/motion-room/reports/motion-physical-v2-pilot.json.gz';
const calibration=JSON.parse(gunzipSync(read(calibrationPath))),physical=JSON.parse(gunzipSync(read(physicalPath)));
if(!calibration.complete||!physical.complete||physical.trials.length!==42)throw Error('Completed source studies required');
const paths=['experiments/visual-behavior/motion-room/replay-candidate.mjs','experiments/visual-behavior/motion-room/decoders.js','experiments/visual-behavior/load-model.mjs',
  ...['sparse-runtime.js','retina.js','readouts/spatial.js','readouts/neural-map-flow.js','readouts/neural-map-flow-v2.js'].map(p=>'shared/vision/'+p)];
const sourceArchive=Object.fromEntries(paths.map(p=>{const code=read(p).toString();return [p,{sha256:hash(code),code}];}));
for(const p of paths.filter(p=>p.startsWith('shared/')&&!p.endsWith('neural-map-flow-v2.js'))){
  if(sourceArchive[p].sha256!==physical.sourceArchive[p]?.sha256||sourceArchive[p].sha256!==calibration.sourceArchive[p]?.sha256)throw Error('Original source changed before replay: '+p);
}
const checkSources=()=>{for(const p of paths)if(hash(read(p))!==sourceArchive[p].sha256)throw Error('Replay source changed during execution: '+p);};
const reference=await loadPackagedFlyvis(),{model,readout}=reference,permutation=coordinatePermutation(model.manifest.inputCoordinates);
if(JSON.stringify(readout.metadata)!==JSON.stringify(physical.metadata)||JSON.stringify(readout.metadata)!==JSON.stringify(calibration.metadata))throw Error('Model/readout identity changed');
const originalFlow=createOriginalFlow(readout.metadata),candidateFlow=createCandidateFlow(readout.metadata);
const remap=values=>Float32Array.from(permutation,i=>values[i]);
const originalPhysical=physical.trials.filter(t=>t.condition==='none-direct');
if(originalPhysical.length!==6)throw Error('Expected all six no-vision/direct trajectories');
const plan=[...calibration.trials.map(t=>({source:'calibration',id:t.id,condition:t.condition})),...originalPhysical.map(t=>({source:'physical',id:t.id,condition:t.condition}))];
const header={format:'duckfly-neural-flow-replay-diagnostic',version:1,run,startedAt:new Date().toISOString(),sourceArchive,modelHashes:reference.hashes,
  sourceStudies:{[calibrationPath]:hash(read(calibrationPath)),[physicalPath]:hash(read(physicalPath))},plan,
  interpretation:'Read-only replay of previously inspected data. No new physical rollout or fresh acceptance evidence. Original-v1 baseline and flow oracle must pass before candidate interpretation.',
  candidate:{solver:'neural-map-flow-v2',maximumSpeed:360,minimumExplained:.2,minimumHorizontalSensitivity:.7,
    feature:'rank1: normalVelocity/normalAxis.x if abs(normalAxis.x)>=.7; rank2: velocity.x; unavailable eye contributes zero; bilateral mean; image degrees converted to radians',
    calibration:'Fixed lambda.1 ridge and quarter of moving TRAIN tenth-percentile gradient, as in prior renderer protocol. Existing heldout replay remains diagnostic only.'}};
const output=fileURLToPath(new URL(run+'.jsonl',reports));
fs.writeFileSync(output,JSON.stringify({event:'start',data:header})+'\n',{flag:'wx'});
const retain=(event,data)=>{checkSources();fs.appendFileSync(output,JSON.stringify({event,data})+'\n');};

function numericDifference(actual,expected,path='flow'){
  if(typeof expected==='number'){
    if(typeof actual!=='number'||!Number.isFinite(actual))throw Error('Nonfinite oracle at '+path);
    const difference=Math.abs(actual-expected);if(difference>1e-6)throw Error(`Original-v1 oracle differs at ${path}: ${actual} versus ${expected}`);return difference;
  }
  if(expected===null||typeof expected!=='object'){
    if(actual!==expected)throw Error('Oracle identity differs at '+path);return 0;
  }
  return Math.max(0,...Object.entries(expected).map(([key,value])=>numericDifference(actual?.[key],value,path+'.'+key)));
}
function candidateFeature(row,floor){
  return [mean(row.candidateFlows.map(flow=>{
    if(!flow.available||flow.gradientRms<floor)return 0;
    if(flow.observedRank===1)return Math.abs(flow.normalAxis.x)>=.7?flow.normalVelocity/flow.normalAxis.x*Math.PI/180:0;
    return flow.velocity.x*Math.PI/180;
  }))];
}
function physicalFrames(trial){
  let previous=null;
  return trial.trace.flatMap((step,index)=>{
    if(!step.frame)return [];
    const heading=index?trial.trace[index-1].body.heading:trial.initial.heading;
    const rigidYawProxy=previous?(step.panoramaAngle-previous.panoramaAngle-wrap(heading-previous.heading))/.04:null;
    previous={heading,panoramaAngle:step.panoramaAngle};
    return [{...step.frame,time:step.time,rigidYawProxy}];
  });
}
async function replay(trial,source){
  const frames=source==='calibration'?trial.rows:physicalFrames(trial),states=[],first=frames[0];
  let baselineMaxError=0,oracleMaxError=0;const rows=[];
  try{
    for(let side=0;side<2;side++){
      const eye=model.eye(model.arrays.bias),name=side?'right':'left',input=remap(decode(first.retina[name]));
      for(let i=0;i<500;i++)eye.step(Float32Array.from(input,v=>.5+(v-.5)*i/499));
      const originalBaseline=trial.identity.baselines[side],baseline=readout.baseline(eye.checkpoint(),{
        id:originalBaseline.id,neuralTime:originalBaseline.neuralTime,method:originalBaseline.method,conditioningSeconds:originalBaseline.conditioningSeconds});
      for(const type of Object.keys(baseline.populations))for(let j=0;j<721;j++)baselineMaxError=Math.max(baselineMaxError,Math.abs(baseline.populations[type][j]-originalBaseline.populations[type][j]));
      if(baselineMaxError!==0)throw Error('Conditioned model baseline is not exactly reproducible');
      states.push({eye,baseline,previous:null});
    }
    for(const frame of frames){
      const candidateFlows=[],rawMaps=[];
      for(let side=0;side<2;side++){
        const state=states[side],name=side?'right':'left',input=remap(decode(frame.retina[name]));let activity;
        for(let i=0;i<20;i++)activity=state.eye.step(input);
        const interval=frame.responses[side];
        const response=readout.extract(activity,state.baseline,{duckId:'duck-1',eyeId:name,sourceId:frame.sourceId,frameId:frame.frameId,captureTime:frame.captureTime,
          neuralStartTime:interval.neuralStartTime,neuralEndTime:interval.neuralEndTime,clock:'simulation'});
        const oldFlow=state.previous?originalFlow.estimate(state.previous,response,{minimumGradient:0,minimumExplained:.2,maximumSpeed:360}):{available:false,reason:'no-history',velocity:null,gradientRms:0};
        oracleMaxError=Math.max(oracleMaxError,numericDifference(oldFlow,frame.neuralFlows[side]));
        candidateFlows.push(state.previous?candidateFlow.estimate(state.previous,response,{minimumGradient:0,minimumExplained:.2,maximumSpeed:360}):{available:false,reason:'no-history',velocity:null,gradientRms:0});
        if(source==='physical')rawMaps.push(Object.fromEntries(Object.entries(response.populations).map(([type,pop])=>[type,encode(pop.raw)])));
        state.previous=response;
      }
      rows.push({time:frame.time,captureTime:frame.captureTime,availableAt:frame.availableAt,frameId:frame.frameId,sourceId:frame.sourceId,clock:frame.clock,
        rate:frame.rate,family:frame.family,rigidYawProxy:frame.rigidYawProxy,conventional:frame.conventional,originalPredictions:frame.predictions,
        candidateFlows,...(source==='physical'?{rawMaps:{encoding:'base64-little-endian-float32',length:721,left:rawMaps[0],right:rawMaps[1]}}:{})});
    }
    return {source,id:trial.id,condition:trial.condition,parameters:trial.parameters,baselineMaxError,oracleMaxError,rows};
  }finally{for(const state of states)state.eye.dispose();}
}

try{
  const trials=[];
  for(const source of ['calibration','physical'])for(const trial of source==='calibration'?calibration.trials:originalPhysical){
    const result=await replay(trial,source);trials.push(result);retain('trial',result);
    console.log(JSON.stringify({completed:trials.length,expected:plan.length,source,id:trial.id,frames:result.rows.length,baselineMaxError:result.baselineMaxError,oracleMaxError:result.oracleMaxError}));
  }
  const train=trials.filter(t=>t.source==='calibration'&&t.condition==='train').flatMap(t=>t.rows).filter(r=>r.time>=.2&&(!r.rate||r.time>=.6));
  const heldout=trials.filter(t=>t.source==='calibration'&&t.condition==='heldout').flatMap(t=>t.rows);
  const gradients=train.filter(r=>r.rate!==0).flatMap(r=>r.candidateFlows.map(f=>f.gradientRms)).filter(Number.isFinite).sort((a,b)=>a-b);
  const minimumGradient=gradients[Math.floor((gradients.length-1)*.1)]*.25;
  for(const trial of trials)for(const row of trial.rows)row.flyvis=candidateFeature(row,minimumGradient);
  const decoder=fitRidge(train.map(r=>r.flyvis),train.map(r=>r.rate),.1),reusedHeldoutScore=scoreDecoder(decoder,heldout,'flyvis');
  const physicalDiagnostics=trials.filter(t=>t.source==='physical').map(t=>{
    const rows=t.rows.filter(r=>r.rigidYawProxy!==null&&r.time>=.2);
    const mae=key=>mean(rows.map(r=>Math.abs((key==='candidate'?predict(decoder,r.flyvis):r.originalPredictions[key])-r.rigidYawProxy)));
    return {id:t.id,condition:t.condition,frames:rows.length,rigidYawProxyMAE:{candidate:mae('candidate'),originalFlyvis:mae('flyvis'),conventional:mae('conventional')},
      maximumAbsRate:{candidate:Math.max(...rows.map(r=>Math.abs(predict(decoder,r.flyvis)))),originalFlyvis:Math.max(...rows.map(r=>Math.abs(r.originalPredictions.flyvis)))},
      availableEyeFraction:mean(rows.flatMap(r=>r.candidateFlows.map(f=>Number(f.available&&f.gradientRms>=minimumGradient&&(f.observedRank===2||Math.abs(f.normalAxis.x)>=.7))))),
      interpretation:'Proxy uses evaluator-only panorama-minus-body-yaw change. It omits camera pitch/roll and translation, so this is diagnostic error, not complete retinal ground truth or a physical benefit estimate.'};
  });
  const result={complete:true,finishedAt:new Date().toISOString(),trialCount:trials.length,frameCount:trials.reduce((sum,t)=>sum+t.rows.length,0),
    baselineMaxError:Math.max(...trials.map(t=>t.baselineMaxError)),oracleMaxError:Math.max(...trials.map(t=>t.oracleMaxError)),minimumGradient,decoder,reusedHeldoutScore,physicalDiagnostics,
    admission:false,physicalBenefit:false,promotion:false,interpretation:'Old data replay only. Fresh prospective renderer calibration and closed-loop body evidence are still required.'};
  retain('complete',result);
  fs.writeFileSync(new URL(run+'.json.gz',reports),gzipSync(JSON.stringify({...header,...result,trials})),{flag:'wx'});
  fs.writeFileSync(new URL(run+'-summary.json',reports),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result));
}catch(error){retain('failure',{message:error.message,stack:error.stack});throw error;}
