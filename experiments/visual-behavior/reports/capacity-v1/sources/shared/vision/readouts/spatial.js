import { RETINA, RETINA_MAP_ID, coordinatePermutation } from '../retina.js';

export const SPATIAL_POPULATIONS = Object.freeze(['T4a', 'T4b', 'T4c', 'T4d', 'T5a', 'T5b', 'T5c', 'T5d']);
// A new export needs a new reviewed identity, not an automatic acceptance of its own hashes.
export const SPATIAL_MODEL_PIN = Object.freeze({
  modelId: 'flyvis-000',
  manifestCanonicalSha256: '826051cb1333da60ca5aea40664427390ec7fe545e4d81671e755ba1460b4f58',
  wasmSha256: '7225b966d087253f204f50f1ec1fc85cb76286466d8e94b8af3e6a911a81f9b0',
});

const finite = value => typeof value === 'number' && Number.isFinite(value);
const canonical = value => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const bytesOf = value => value instanceof ArrayBuffer
  ? new Uint8Array(value)
  : ArrayBuffer.isView(value)
    ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : (() => { throw Error('Expected model bytes'); })();
const sha256 = async value => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytesOf(value))), n => n.toString(16).padStart(2, '0')).join('');
const freezeTree = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
};
const identifier = (value, name) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 160) throw Error(`Invalid ${name}`);
  return value;
};

function validateManifest(manifest) {
  if (!manifest || manifest.format !== 'duckfly-flyvis-sparse' || manifest.version !== 1 ||
      manifest.nodes !== 45669 || manifest.edges !== 1513231 || manifest.dt !== .002 ||
      manifest.validation?.numericalParity !== true || manifest.publishedWeightsEqual !== true) {
    throw Error('Unsupported spatial Flyvis model identity');
  }
  coordinatePermutation(manifest.inputCoordinates);
  const seen = new Set();
  if (Object.keys(manifest.readouts ?? {}).length !== SPATIAL_POPULATIONS.length ||
      Object.keys(manifest.readoutCoordinates ?? {}).length !== SPATIAL_POPULATIONS.length) {
    throw Error('Expected the eight pinned T4/T5 populations');
  }
  for (const type of SPATIAL_POPULATIONS) {
    const indices = manifest.readouts[type];
    if (!Array.isArray(indices) || indices.length !== RETINA.length) throw Error(`Invalid ${type} index count`);
    for (const index of indices) {
      if (!Number.isSafeInteger(index) || index < 0 || index >= manifest.nodes || seen.has(index)) {
        throw Error(`Invalid or duplicate ${type} neuron index`);
      }
      seen.add(index);
    }
    coordinatePermutation(manifest.readoutCoordinates[type]);
  }
}

/** Verify the actual export bytes before constructing an extraction-only readout. */
export async function createSpatialFlyvisReadout({ manifest, arrays, wasmBytes }) {
  validateManifest(manifest);
  if (await sha256(new TextEncoder().encode(canonical(manifest))) !== SPATIAL_MODEL_PIN.manifestCanonicalSha256) {
    throw Error('Spatial Flyvis manifest differs from the pinned export');
  }
  if (await sha256(wasmBytes) !== SPATIAL_MODEL_PIN.wasmSha256) throw Error('Spatial Flyvis WASM identity mismatch');
  for (const [name, spec] of Object.entries(manifest.arrays)) {
    const array = arrays?.[name], Type = spec.dtype === '<u4' ? Uint32Array : Float32Array;
    if (!(array instanceof Type) || array.length !== spec.length || !array.every(Number.isFinite)) {
      throw Error(`Invalid spatial Flyvis ${name} array`);
    }
    if (await sha256(array) !== spec.sha256) throw Error(`Spatial Flyvis ${name} hash mismatch`);
  }

  const nodeCount = manifest.nodes;
  const indices = Object.fromEntries(SPATIAL_POPULATIONS.map(type => [type, [...manifest.readouts[type]]]));
  const populations = Object.fromEntries(SPATIAL_POPULATIONS.map(type => {
    const permutation = coordinatePermutation(manifest.readoutCoordinates[type]);
    return [type, {
      nodeIndices: indices[type],
      coordinates: Array.from(permutation, i => {
        const { u, v, azimuth, elevation } = RETINA[i];
        return { u, v, azimuth, elevation };
      }),
    }];
  }));
  const modelIdentity = {
    id: SPATIAL_MODEL_PIN.modelId,
    sourceCommit: manifest.sourceCommit,
    checkpoint: manifest.checkpoint,
    checkpointSha256: manifest.checkpointSha256,
    loadedCheckpointSha256: manifest.loadedCheckpointSha256,
    manifestCanonicalSha256: SPATIAL_MODEL_PIN.manifestCanonicalSha256,
    wasmSha256: SPATIAL_MODEL_PIN.wasmSha256,
    integrationDt: manifest.dt,
    units: manifest.activityUnits,
  };
  const metadata = freezeTree({
    format: 'duckfly-spatial-flyvis-metadata', version: 1,
    model: modelIdentity,
    coordinateSystem: {
      id: RETINA_MAP_ID, frame: 'eye-relative', angularUnits: 'degrees',
      positiveAzimuth: 'image-right', positiveElevation: 'image-up',
      projection: 'experimental uniform axial hex grid, 2.3 degrees spacing',
      anatomicalReferenceEye: 'right',
      interpretation: 'Experimental camera sampling geometry, not a measured whole-eye fly projection. Reusing the model for a left camera does not create an anatomical left-eye model. Subtype names are not calibrated body-relative directions.',
    },
    populations,
    interpretation: 'Signed continuous model activity. Delta is raw minus the declared reference baseline; no clipping, normalization, motor command, or higher visual neuron is added.',
    validation: { numericalExportVerified: true, physiologicalReproduction: false, bodyBridge: false },
  });
  const baselines = new WeakSet();
  const state = activity => {
    if (!(activity instanceof Float32Array) || activity.length !== nodeCount || !activity.every(Number.isFinite)) {
      throw Error('Expected a finite full Float32 Flyvis state');
    }
  };

  function restoreBaseline(serialized) {
    if (!serialized || serialized.version !== 1 || serialized.modelId !== metadata.model.id ||
        serialized.checkpointSha256 !== metadata.model.checkpointSha256 ||
        serialized.manifestCanonicalSha256 !== metadata.model.manifestCanonicalSha256 ||
        serialized.units !== metadata.model.units) throw Error('Baseline model or checkpoint identity mismatch');
    const { id, neuralTime, method, conditioningSeconds } = serialized;
    identifier(id, 'baseline id'); identifier(method, 'baseline method');
    if (!finite(neuralTime) || neuralTime < 0 || !finite(conditioningSeconds) || conditioningSeconds < 0) {
      throw Error('Invalid baseline clock');
    }
    if (!serialized.populations || Object.keys(serialized.populations).length !== SPATIAL_POPULATIONS.length) {
      throw Error('Expected eight baseline population maps');
    }
    for (const type of SPATIAL_POPULATIONS) {
      const values = serialized.populations[type];
      if ((!Array.isArray(values) && !(values instanceof Float32Array)) || values.length !== 721 || !values.every(finite)) {
        throw Error(`Invalid ${type} baseline map`);
      }
      if (values.some(value => Math.fround(value) !== value)) throw Error(`Expected Float32 values in ${type} baseline map`);
    }
    // Copy only validated fields. Neither caller-owned maps nor JSON records enter the trusted set directly.
    const result = freezeTree({
      version: 1, id, modelId: metadata.model.id, checkpointSha256: metadata.model.checkpointSha256,
      manifestCanonicalSha256: metadata.model.manifestCanonicalSha256, units: metadata.model.units,
      neuralTime, method, conditioningSeconds,
      populations: Object.fromEntries(SPATIAL_POPULATIONS.map(type => [type, Array.from(serialized.populations[type])])),
    });
    baselines.add(result);
    return result;
  }

  function baseline(activity, { id, neuralTime, method, conditioningSeconds = 0 }) {
    state(activity);
    return restoreBaseline({
      version: 1, id, modelId: metadata.model.id, checkpointSha256: metadata.model.checkpointSha256,
      manifestCanonicalSha256: metadata.model.manifestCanonicalSha256, units: metadata.model.units,
      neuralTime, method, conditioningSeconds,
      populations: Object.fromEntries(SPATIAL_POPULATIONS.map(type => [type, indices[type].map(i => activity[i])])),
    });
  }

  function extract(activity, reference, interval) {
    state(activity);
    if (!baselines.has(reference)) throw Error('Baseline belongs to another spatial readout; restore it explicitly');
    const { duckId, eyeId, sourceId, frameId, captureTime, neuralStartTime, neuralEndTime, clock } = interval ?? {};
    for (const [name, value] of Object.entries({ duckId, eyeId, sourceId, clock })) identifier(value, name);
    if (!Number.isSafeInteger(frameId) || frameId < 0 ||
        ![captureTime, neuralStartTime, neuralEndTime].every(finite) || captureTime < 0 ||
        neuralStartTime < reference.neuralTime || neuralStartTime + 1e-9 < captureTime || neuralEndTime <= neuralStartTime) {
      throw Error('Invalid spatial response interval or future visual input');
    }
    const steps = (neuralEndTime - neuralStartTime) / metadata.model.integrationDt;
    if (Math.abs(steps - Math.round(steps)) > 1e-6) throw Error('Neural interval must contain whole integration steps');
    return {
      version: 1, modelId: metadata.model.id, checkpointSha256: metadata.model.checkpointSha256,
      baselineId: reference.id, duckId, eyeId, sourceId, frameId, captureTime,
      neuralStartTime, neuralEndTime, integrationSteps: Math.round(steps), clock,
      populations: Object.fromEntries(SPATIAL_POPULATIONS.map(type => {
        const raw = Float32Array.from(indices[type], index => activity[index]);
        return [type, { raw, delta: Float32Array.from(raw, (value, i) => value - reference.populations[type][i]) }];
      })),
    };
  }

  return Object.freeze({ metadata, baseline, restoreBaseline, extract });
}

/** JSON-safe copies, including typed response arrays; never round scientific values. */
export function spatialToJSON(value) {
  if (ArrayBuffer.isView(value)) return Array.from(value);
  if (Array.isArray(value)) return value.map(spatialToJSON);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, spatialToJSON(entry)]));
  return value;
}
