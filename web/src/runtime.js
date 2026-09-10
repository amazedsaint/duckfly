import * as ort from 'onnxruntime-web/wasm';
import { World } from './world.js';
import { fetchBytes } from './assets.js';
export async function createWorld(progress=()=>{}) {
  const base=new URL('../',self.location.href);
  // Worker script lives in /assets/. Runtime and models are same-origin static files.
  const url=path=>new URL(path,base).href;
  progress('Loading physics engine');
  const {default:loadMujoco}=await import(/* @vite-ignore */ url('runtime/mujoco.js'));
  const mj=await loadMujoco({locateFile:name=>url(`runtime/${name}`)});
  progress('Loading Microduck body and walking policy');
  const [binary,config,policy]=await Promise.all([
    fetchBytes(url('assets/Simulation/microduck.mjb.gz'),true),
    fetch(url('assets/Simulation/config.json')).then(r=>{if(!r.ok)throw Error('Model configuration missing');return r.json();}),
    fetchBytes(url('assets/Policies/alpha_walking.onnx')),
  ]);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',binary)),n=>n.toString(16).padStart(2,'0')).join('');
  if(digest!==config.modelSHA256) throw new Error('Robot model integrity check failed. Reload to refresh the assets.');
  progress('Starting local simulation');
  // FS.writeFile copies the buffer in bulk. MjVFS.addBuffer marshals bytes
  // individually in this binding and makes this model take ~30 seconds to load.
  mj.FS.writeFile('/microduck.mjb',binary);
  const vfs=new mj.MjVFS();
  let model;
  try { model=mj.MjModel.from_binary_path('/microduck.mjb',vfs); }
  finally { vfs.delete();mj.FS.unlink('/microduck.mjb'); }
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=url('runtime/');
  const session=await ort.InferenceSession.create(policy,{executionProviders:['wasm']});
  return new World(mj,model,config,session,ort.Tensor);
}
