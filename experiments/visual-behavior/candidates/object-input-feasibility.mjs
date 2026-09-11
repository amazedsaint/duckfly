import {readFile, writeFile} from 'node:fs/promises';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {loadPackagedFlyvis} from '../load-model.mjs';
import {sampleRetina} from '../../../shared/vision/retina.js';
import {EYE_CALIBRATION} from '../../../shared/vision/frame.js';
import {OBJECT_INPUT_SIDECAR_SHA256, createObjectInputReadout, AdaptiveObjectInputPool} from './object-input-readout.mjs';
import {cases, frameTimes, movieFrame} from './movies.mjs';

const sha = b => createHash('sha256').update(b).digest('hex'), reports = new URL('../reports/', import.meta.url);
const sidecarBytes = await readFile(new URL('object-input-indices.json', import.meta.url));
if (sha(sidecarBytes) !== OBJECT_INPUT_SIDECAR_SHA256) throw Error('Object input sidecar differs from verified reference export');
const arenaBytes = await readFile(new URL('candidates-arena-transfer.json.gz', reports)), arena = JSON.parse(gunzipSync(arenaBytes));
const synthetic = cases('calibration', 2).filter(c => ['small-pass', 'small-step', 'large-bar', 'stationary-flicker', 'global-flash', 'textured-small-pass'].includes(c.family));
const movies = [...synthetic.map(c => ({id: c.id, source: 'synthetic-feasibility', family: c.family,
  frames: frameTimes(c).map(time => ({time, pixels: movieFrame(c, time).pixels}))})),
...arena.records.map(r => ({id: r.id, source: 'actual-arena-transfer', family: r.family,
  frames: r.frames.map(f => ({time: f.time, pixels: new Uint8Array(Buffer.from(f.rgba, 'base64'))}))}))];
const loaded = await loadPackagedFlyvis(), objectReadout = createObjectInputReadout(JSON.parse(sidecarBytes), loaded);
const results = [], maps = [];
try {
  for (const m of movies) {
    const eye = loaded.model.eye(), first = sampleRetina(m.frames[0].pixels, EYE_CALIBRATION);
    try {
      for (let i = 0; i < 500; i++) eye.step(first);
      const baseline = objectReadout.extract(eye.checkpoint());
      const pools = Object.fromEntries(['T2', 'T3'].map(type => [type, [new AdaptiveObjectInputPool(objectReadout.populations[type].coordinates), new AdaptiveObjectInputPool(objectReadout.populations[type].coordinates, {adaptation: false})]]));
      const trace = [], saved = [];
      for (const f of m.frames) {
        const input = sampleRetina(f.pixels, EYE_CALIBRATION); let activity;
        for (let i = 0; i < 20; i++) activity = eye.step(input);
        const raw = objectReadout.extract(activity), delta = Object.fromEntries(['T2', 'T3'].map(type => [type, Float32Array.from(raw[type], (v, i) => v - baseline[type][i])]));
        trace.push({time: f.time, ...Object.fromEntries(['T2', 'T3'].map(type => [type, {adapted: pools[type][0].step(delta[type], .04), unadapted: pools[type][1].step(delta[type], .04)}]))});
        saved.push(Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, Array.from(v)])));
      }
      const post = trace.filter(t => t.time >= .24);
      const metrics = Object.fromEntries(['T2', 'T3'].map(type => [type, Object.fromEntries(['adapted', 'unadapted'].map(condition => [condition, {
        peakPool: Math.max(...post.map(t => t[type][condition].pooled)),
        meanPool: post.reduce((s, t) => s + t[type][condition].pooled, 0) / post.length,
        peakColumn: Math.max(...post.map(t => t[type][condition].peakColumn)),
      }]))]));
      results.push({id: m.id, source: m.source, family: m.family, metrics, trace}); maps.push({id: m.id, baseline: Object.fromEntries(Object.entries(baseline).map(([k,v]) => [k, Array.from(v)])), signedDeltaFrames: saved});
      console.log(`${m.id}: T3 mean adapted=${metrics.T3.adapted.meanPool.toFixed(6)}, unadapted=${metrics.T3.unadapted.meanPool.toFixed(6)}`);
    } finally {eye.dispose();}
  }
} finally {loaded.model.dispose();}
const groups = {};
for (const r of results) (groups[`${r.source}/${r.family}`] ??= []).push(r.metrics);
const sources = Object.fromEntries(await Promise.all(['object-input-readout.mjs', 'object-input-feasibility.mjs', 'object-input-indices.json'].map(async name => [name, sha(await readFile(new URL(name, import.meta.url)))])));
const mapBytes = gzipSync(JSON.stringify({populations: objectReadout.populations, maps}), {level: 9});
const record = {version: 1, stage: 'exploratory feasibility only', sources, loadedModelHashes: loaded.hashes,
  parentArenaArtifactSha256: sha(arenaBytes), mapsSha256: sha(mapBytes), neuralDt: .002, inputHoldSeconds: .04,
  adaptationSeconds: .3, adaptationGain: 100, poolingSigmaDegrees: 10, outputLowpassSeconds: .3,
  interpretation: 'Actual T2/T3 model activity plus separately engineered adaptation/spatial pooling. Not the published DDModel, no LC11 neurons, no motor bridge.',
  productionPromotion: false, heldoutValidation: false, physicalUsefulnessTested: false, groups, results};
await writeFile(new URL('candidates-object-input-feasibility-maps.json.gz', reports), mapBytes);
await writeFile(new URL('candidates-object-input-feasibility.json.gz', reports), gzipSync(JSON.stringify(record), {level: 9}));
const {results: _, ...summary} = record;
await writeFile(new URL('candidates-object-input-feasibility-summary.json', reports), JSON.stringify(summary, null, 2) + '\n');
