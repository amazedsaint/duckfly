import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { SparseVisionModel } from '../../shared/vision/sparse-runtime.js';
import { createSpatialFlyvisReadout } from '../../shared/vision/readouts/spatial.js';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const visionRoot = new URL('../../shared/vision/', import.meta.url);
export const readVision = path => fs.readFileSync(new URL(path, visionRoot));

export async function loadPackagedFlyvis() {
  const manifestBytes = readVision('models/flyvis-000/manifest.json');
  const manifest = JSON.parse(manifestBytes), arrays = {}, arrayHashes = {};
  for (const [name, spec] of Object.entries(manifest.arrays)) {
    const bytes = gunzipSync(readVision(`models/flyvis-000/${spec.file}`));
    if (hash(bytes) !== spec.sha256) throw Error(`Packaged ${name} hash mismatch`);
    const buffer = new Uint8Array(bytes).buffer;
    arrays[name] = spec.dtype === '<u4' ? new Uint32Array(buffer) : new Float32Array(buffer);
    arrayHashes[name] = hash(bytes);
  }
  const wasmBytes = readVision('wasm/core.wasm');
  const readout = await createSpatialFlyvisReadout({ manifest, arrays, wasmBytes });
  const model = await SparseVisionModel.create(wasmBytes, manifest, arrays);
  return {
    model, manifest, arrays, wasmBytes, readout,
    hashes: {
      manifestFile: hash(manifestBytes), wasm: hash(wasmBytes), arrays: arrayHashes,
      sparseRuntime: hash(readVision('sparse-runtime.js')),
      spatialReadout: hash(readVision('readouts/spatial.js')),
      retina: hash(readVision('retina.js')),
    },
  };
}
