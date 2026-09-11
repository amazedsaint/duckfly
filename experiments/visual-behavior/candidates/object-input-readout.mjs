import {RETINA} from '../../../shared/vision/retina.js';
export const OBJECT_INPUT_SIDECAR_SHA256 = 'd61d612526675208afb3c224eec636234f161dd0d98bf7c557a60bb064e9d379';

// The loader verifies sidecar bytes before calling this. Every index comes from
// the reference node table, with parameter arrays and existing readouts matched.
export function createObjectInputReadout(sidecar, loaded) {
  if (sidecar.format !== 'duckfly-object-input-sidecar' || sidecar.version !== 1 ||
      sidecar.checkpointSha256 !== loaded.manifest.checkpointSha256 ||
      sidecar.packagedManifestSha256 !== loaded.hashes.manifestFile || !sidecar.existingEightReadoutsMatch || !sidecar.publishedWeightsEqual) throw Error('Object-input provenance mismatch');
  for (const [name, hash] of Object.entries(sidecar.arrayHashesVerified)) if (hash !== loaded.hashes.arrays[name]) throw Error('Object-input row order mismatch');
  const retina = new Map(RETINA.map(c => [`${c.u},${c.v}`, c])), used = new Set();
  const populations = {};
  for (const type of ['T2', 'T3']) {
    const p = sidecar.populations[type];
    if (p.nodeIndices.length !== 721 || p.axialCoordinates.length !== 721) throw Error('Incomplete object input map');
    const coordinates = p.axialCoordinates.map(([u, v]) => retina.get(`${u},${v}`));
    if (coordinates.some(c => !c) || new Set(coordinates).size !== 721) throw Error('Object input map is not a retinal bijection');
    for (const n of p.nodeIndices) {
      if (!Number.isSafeInteger(n) || n < 0 || n >= loaded.manifest.nodes || used.has(n)) throw Error('Invalid object input node');
      used.add(n);
    }
    populations[type] = {nodeIndices: [...p.nodeIndices], coordinates};
  }
  const extract = activity => {
    if (!(activity instanceof Float32Array) || activity.length !== loaded.manifest.nodes || !activity.every(Number.isFinite)) throw Error('Invalid full model state');
    return Object.fromEntries(Object.entries(populations).map(([type, p]) => [type, Float32Array.from(p.nodeIndices, n => activity[n])]));
  };
  return {populations, extract};
}

// Declared downstream hypothesis motivated by adaptation + pooling, not a port
// of DDModel: continuous Flyvis units require their own gain calibration.
export class AdaptiveObjectInputPool {
  constructor(coordinates, {adaptation = true} = {}) {
    this.adaptation = adaptation;
    this.filters = [-18, 0, 18].flatMap(x => [-15, 0, 15].map(y => {
      const weights = coordinates.map(c => Math.exp(-((c.azimuth - x) ** 2 + (c.elevation - y) ** 2) / 200));
      const total = weights.reduce((a, b) => a + b, 0);
      return weights.map(w => w / total);
    }));
    this.adapt = new Float64Array(coordinates.length); this.pool = new Float64Array(this.filters.length);
  }
  step(delta, dt) {
    if (!(delta instanceof Float32Array) || delta.length !== this.adapt.length || !delta.every(Number.isFinite) || !(dt > 0 && dt <= .1)) throw Error('Invalid adaptive input');
    const positive = Float64Array.from(delta, v => Math.max(0, v)), response = new Float64Array(delta.length);
    const decay = Math.exp(-dt / .3);
    for (let i = 0; i < positive.length; i++) {
      this.adapt[i] = decay * this.adapt[i] + (1 - decay) * positive[i];
      response[i] = this.adaptation ? positive[i] / (1 + 100 * this.adapt[i]) : positive[i];
    }
    for (let k = 0; k < this.filters.length; k++) {
      const value = this.filters[k].reduce((sum, weight, i) => sum + weight * response[i], 0);
      this.pool[k] = decay * this.pool[k] + (1 - decay) * value;
    }
    return {pooled: Math.max(...this.pool), peakColumn: Math.max(...positive),
      meanColumn: positive.reduce((a, b) => a + b, 0) / positive.length};
  }
}
