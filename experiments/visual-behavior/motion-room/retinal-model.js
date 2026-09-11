import {sampleRetina,coordinatePermutation} from '../../../shared/vision/retina.js';
import {spatialFeatures,retinalFlow} from './decoders.js';
import {createNeuralMapFlow} from '../../../shared/vision/readouts/neural-map-flow.js';

const base64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=4096)s+=String.fromCharCode(...bytes.subarray(i,i+4096));return btoa(s);};
export const encodeFloats=array=>base64(new Uint8Array(new Float32Array(array).buffer));
export class RetinalModels{
  constructor(reference){this.reference=reference;this.permutation=coordinatePermutation(reference.model.manifest.inputCoordinates);this.states=[];this.neuralFlow=createNeuralMapFlow(reference.readout.metadata);}
  sample(packet){return ['left','right'].map(eye=>sampleRetina(packet.views?.[eye]??packet.pixels,packet.calibration));}
  remap(values){return Float32Array.from(this.permutation,i=>values[i]);}
  async initialize(packet){
    this.dispose();const {model,readout}=this.reference,samples=this.sample(packet);
    for(let side=0;side<2;side++){
      const eye=model.eye(model.arrays.bias),input=this.remap(samples[side]);this.states.push({eye,previous:null});
      for(let i=0;i<500;i++){eye.step(Float32Array.from(input,v=>.5+(v-.5)*i/499));if(i%100===0)await new Promise(r=>setTimeout(r,0));}
      this.states[side].baseline=readout.baseline(eye.checkpoint(),{id:`motion-room-${packet.sourceId}-${packet.frameId}-${side}`,neuralTime:packet.captureTime,method:'one-second fade from bias to frozen initial rendered image; model clock rebased to body capture time',conditioningSeconds:1});
    }
    this.time=packet.captureTime;
    return {metadata:readout.metadata,baselines:this.states.map(s=>s.baseline)};
  }
  step(packet){
    const samples=this.sample(packet),{readout}=this.reference,features=[],flows=[],responses=[],costs=[],neuralFlows=[];
    if(Math.abs(packet.captureTime-this.time)>1e-7)throw Error('Retinal/model clock discontinuity');
    for(let side=0;side<2;side++){
      const state=this.states[side],input=this.remap(samples[side]),start=performance.now();let activity;
      for(let i=0;i<20;i++)activity=state.eye.step(input);
      const coreMs=performance.now()-start,extractStart=performance.now();
      const response=readout.extract(activity,state.baseline,{duckId:'duck-1',eyeId:side?'right':'left',sourceId:packet.sourceId,frameId:packet.frameId,captureTime:packet.captureTime,neuralStartTime:this.time,neuralEndTime:this.time+.04,clock:'simulation'});
      features.push(...spatialFeatures(response,readout.metadata));
      const neuralFlow=state.previousSpatial?this.neuralFlow.estimate(state.previousSpatial,response,{minimumGradient:0,minimumExplained:.2,maximumSpeed:360}):{available:false,reason:'no-history',velocity:null,gradientRms:0};
      neuralFlows.push(neuralFlow);state.previousSpatial=response;
      const flowStart=performance.now(),flow=retinalFlow(state.previous,samples[side],.04);flows.push(flow);state.previous=samples[side];
      responses.push({eyeId:response.eyeId,baselineId:response.baselineId,neuralStartTime:response.neuralStartTime,neuralEndTime:response.neuralEndTime});
      costs.push({eyeId:response.eyeId,coreMs,extractionMs:flowStart-extractStart,conventionalMs:performance.now()-flowStart});
    }
    this.time+=.04;
    return {spatialBins:features,conventional:[(flows[0].horizontal+flows[1].horizontal)/2],flows,neuralFlows,
      captureTime:packet.captureTime,availableAt:this.time,frameId:packet.frameId,sourceId:packet.sourceId,clock:packet.clock,
      retina:{encoding:'base64-little-endian-float32',length:721,left:encodeFloats(samples[0]),right:encodeFloats(samples[1])},responses,costs};
  }
  dispose(){for(const state of this.states)state.eye.dispose();this.states=[];}
}
