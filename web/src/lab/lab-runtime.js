import * as ort from 'onnxruntime-web/wasm';
import { fetchBytes, fetchJSON } from '../assets.js';
import { mountTemplate } from './lab-world.js';
import { TemporalDecoder } from '../../../shared/vision/temporal/decoder.js';
export async function loadLabRuntime(base,progress=()=>{}){
  const url=path=>new URL(path,base).href;
  progress('Loading the physics engine…');
  const {default:load}=await import(/* @vite-ignore */ url('runtime/mujoco.js'));
  const options=label=>({label,onProgress:progress});
  const [mj,template,circuit,policy]=await Promise.all([load({locateFile:name=>url(`runtime/${name}`)}),
    fetchJSON(url('assets/Simulation/lab-template.json.gz'),options('Robot physics')),
    fetchJSON(url('assets/Brain/circuit.json'),options('Fly circuit')),
    fetchBytes(url('assets/Policies/alpha_walking.onnx'),options('Walking controller'))]);
  progress('Preparing robot physics…');mountTemplate(mj,template);
  // Mesh bytes now live in MuJoCo's filesystem. Scene compilation only needs
  // the XML, so release the second, base64-encoded copy on mobile as well.
  delete template.files;
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=url('runtime/');
  progress('Starting the walking controller…');
  const session=await ort.InferenceSession.create(policy,{executionProviders:['wasm']});
  const skillSessions={};
  for(const [name,file] of Object.entries({standing:'alpha_stand.onnx',kick:'ball_kick_left.onnx'})){
    progress(`Loading the ${name==='standing'?'balance':'kick'} controller…`);
    skillSessions[name]=await ort.InferenceSession.create(await fetchBytes(url('assets/Policies/'+file),options(name==='standing'?'Balance controller':'Kick controller')),{executionProviders:['wasm']});
  }
  progress('Connecting vision to the fly circuit…');
  const {default:model}=await import('../../../shared/vision/temporal/no-pose.json');
  return {mj,template,circuit,session,skillSessions,Tensor:ort.Tensor,temporalDecoder:new TemporalDecoder(model)};
}
