import * as ort from 'onnxruntime-web/wasm';
import { fetchBytes } from '../assets.js';
import { mountTemplate } from './lab-world.js';
export async function loadLabRuntime(base,progress=()=>{}){
  const url=path=>new URL(path,base).href;
  progress('Loading physics and walking policy');
  const {default:load}=await import(/* @vite-ignore */ url('runtime/mujoco.js'));
  const [mj,compressed,circuit,policy]=await Promise.all([load({locateFile:name=>url(`runtime/${name}`)}),
    fetchBytes(url('assets/Simulation/lab-template.json.gz')),fetch(url('assets/Brain/circuit.json')).then(r=>r.json()),fetchBytes(url('assets/Policies/alpha_walking.onnx'))]);
  const template=JSON.parse(new TextDecoder().decode(compressed));mountTemplate(mj,template);
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=url('runtime/');
  const session=await ort.InferenceSession.create(policy,{executionProviders:['wasm']});
  return {mj,template,circuit,session,Tensor:ort.Tensor};
}
