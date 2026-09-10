import * as ort from 'onnxruntime-web/wasm';
import { fetchBytes } from '../assets.js';
import { mountTemplate } from './lab-world.js';
import { TemporalDecoder } from '../../../shared/vision/temporal/decoder.js';
export async function loadLabRuntime(base,progress=()=>{}){
  const url=path=>new URL(path,base).href;
  progress('Loading physics and walking policy');
  const {default:load}=await import(/* @vite-ignore */ url('runtime/mujoco.js'));
  const [mj,compressed,circuit,policy]=await Promise.all([load({locateFile:name=>url(`runtime/${name}`)}),
    fetchBytes(url('assets/Simulation/lab-template.json.gz')),fetch(url('assets/Brain/circuit.json')).then(r=>r.json()),fetchBytes(url('assets/Policies/alpha_walking.onnx'))]);
  const template=JSON.parse(new TextDecoder().decode(compressed));mountTemplate(mj,template);
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=url('runtime/');
  const session=await ort.InferenceSession.create(policy,{executionProviders:['wasm']});
  const skillSessions={};
  for(const [name,file] of Object.entries({standing:'alpha_stand.onnx',kick:'ball_kick_left.onnx'})){
    skillSessions[name]=await ort.InferenceSession.create(await fetchBytes(url('assets/Policies/'+file)),{executionProviders:['wasm']});
  }
  const {default:model}=await import('../../../shared/vision/temporal/no-pose.json');
  return {mj,template,circuit,session,skillSessions,Tensor:ort.Tensor,temporalDecoder:new TemporalDecoder(model)};
}
