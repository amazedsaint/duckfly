import {readFile, writeFile} from 'node:fs/promises';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {loadPackagedFlyvis} from '../load-model.mjs';
import {sampleRetina} from '../../../shared/vision/retina.js';
import {EYE_CALIBRATION} from '../../../shared/vision/frame.js';
import {SpatialActivityDisplacement} from './spatial-event.mjs';
import {cases, frameTimes, movieFrame} from './movies.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const reports = new URL('../reports/', import.meta.url);
const arenaBytes = await readFile(new URL('candidates-arena-transfer.json.gz', reports));
const arena = JSON.parse(gunzipSync(arenaBytes));
const synthetic = cases('calibration', 2).filter(c => ['small-pass', 'small-step', 'large-bar', 'stationary-flicker', 'global-flash', 'textured-small-pass'].includes(c.family));
const movies = [
  ...synthetic.map(c => ({id: c.id, source: 'synthetic-feasibility', family: c.family,
    frames: frameTimes(c).map(time => ({time, pixels: movieFrame(c, time).pixels}))})),
  ...arena.records.map(r => ({id: r.id, source: 'actual-arena-transfer', family: r.family,
    frames: r.frames.map(f => ({time: f.time, pixels: new Uint8Array(Buffer.from(f.rgba, 'base64'))}))})),
];
const loaded = await loadPackagedFlyvis(), {model, readout, hashes} = loaded;
const results = [], maps = [];
try {
  for (const m of movies) {
    const eye = model.eye(), input0 = sampleRetina(m.frames[0].pixels, EYE_CALIBRATION);
    try {
      for (let i = 0; i < 500; i++) eye.step(input0);
      const reference = readout.baseline(eye.checkpoint(), {id: `initial-${m.id}`, neuralTime: 1, method: 'one-second first-frame conditioning', conditioningSeconds: 1});
      const detector = new SpatialActivityDisplacement(readout.metadata), trace = [], saved = [];
      for (let i = 0; i < m.frames.length; i++) {
        const f = m.frames[i], retina = sampleRetina(f.pixels, EYE_CALIBRATION);
        let activity;
        for (let k = 0; k < 20; k++) activity = eye.step(retina);
        const response = readout.extract(activity, reference, {duckId: 'probe-duck', eyeId: 'cyclopean-camera', sourceId: m.id,
          frameId: i, captureTime: 1 + f.time, neuralStartTime: 1 + f.time, neuralEndTime: 1 + f.time + .04, clock: 'simulation'});
        trace.push(detector.step(response));
        saved.push(Object.fromEntries(Object.entries(response.populations).map(([k, v]) => [k, Array.from(v.delta)])));
      }
      results.push({id: m.id, source: m.source, family: m.family, event: trace.some(t => t.event),
        compactFrames: trace.filter(t => t.compact).length, frameCount: trace.length, trace});
      maps.push({id: m.id, baseline: reference, signedDeltaFrames: saved});
      console.log(`${m.id}: event=${results.at(-1).event}, compact=${results.at(-1).compactFrames}/${trace.length}`);
    } finally {eye.dispose();}
  }
} finally {model.dispose();}
const files = ['spatial-event.mjs', 'spatial-feasibility.mjs'];
const sources = Object.fromEntries(await Promise.all(files.map(async name => [name, sha(await readFile(new URL(name, import.meta.url)))])));
const groups = {};
for (const r of results) {
  const key = `${r.source}/${r.family}`;
  const g = groups[key] ??= {movies: 0, eventMovies: 0, compactFrames: 0, frames: 0};
  g.movies++; g.eventMovies += +r.event; g.compactFrames += r.compactFrames; g.frames += r.frameCount;
}
const mapsBytes = gzipSync(JSON.stringify({metadata: readout.metadata, maps}), {level: 9});
const record = {version: 1, stage: 'exploratory feasibility only', sources, loadedModelHashes: hashes,
  parentArenaArtifactSha256: sha(arenaBytes), neuralDt: .002, inputHoldSeconds: .04, initialConditioningSeconds: 1,
  groups, productionPromotion: false, heldoutValidation: false, physicalUsefulnessTested: false,
  interpretation: 'Engineered spatial T4/T5 activity footprint and centroid tracking; no LC11 neuron or behavioral output circuit.',
  mapsSha256: sha(mapsBytes), results};
await writeFile(new URL('candidates-spatial-feasibility-maps.json.gz', reports), mapsBytes);
await writeFile(new URL('candidates-spatial-feasibility.json.gz', reports), gzipSync(JSON.stringify(record), {level: 9}));
const {results: _, ...summary} = record;
await writeFile(new URL('candidates-spatial-feasibility-summary.json', reports), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary.groups, null, 2));
