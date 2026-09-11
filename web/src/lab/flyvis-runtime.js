import { fetchBytes } from '../assets.js';
import { SparseVisionModel } from '../../../shared/vision/sparse-runtime.js';
import { createSpatialFlyvisReadout } from '../../../shared/vision/readouts/spatial.js';

let referencePromise;

// Share verified weights within a worker. Each consumer owns and disposes its
// own model.eye(), never the shared model or another duck's recurrent state.
export function loadFlyvisReference(){
  if(!referencePromise)referencePromise=load().catch(error=>{referencePromise=null;throw error;});
  return referencePromise;
}

async function load(){
  const base='/assets/Vision/flyvis-000/';
  const response=await fetch(base+'manifest.json');
  if(!response.ok)throw Error('Flyvis model unavailable');
  const manifest=await response.json(),arrays={};
  if(!manifest.validation?.numericalParity)throw Error('Model failed its export gate');
  await Promise.all(Object.entries(manifest.arrays).map(async([name,meta])=>{
    const bytes=await fetchBytes(base+meta.file),buffer=bytes.slice().buffer;
    arrays[name]=meta.dtype==='<u4'?new Uint32Array(buffer):new Float32Array(buffer);
  }));
  const wasmBytes=await fetchBytes('/assets/Vision/core.wasm');
  // This verifies the actual array bytes and the manifest against an external
  // pin, including their retinal index order, before any neural step executes.
  const readout=await createSpatialFlyvisReadout({manifest,arrays,wasmBytes});
  return {model:await SparseVisionModel.create(wasmBytes,manifest,arrays),readout};
}
