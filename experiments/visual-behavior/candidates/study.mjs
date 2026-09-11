import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {EngineeredDisplacementEvent, EngineeredSilhouetteExpansion, CANDIDATE_SETTINGS, WIDTH, HEIGHT} from './detectors.mjs';
import {cases, frameTimes, movieFrame} from './movies.mjs';
import {MotionOpponent} from '../../../shared/vision/motion.js';
import {EYE_CALIBRATION} from '../../../shared/vision/frame.js';

const split = process.argv[2] ?? 'calibration';
const count = split === 'heldout' ? 32 : 8;
if (!['calibration', 'heldout'].includes(split)) throw Error('Expected calibration or heldout');
const output = fileURLToPath(new URL('../reports/', import.meta.url));
await mkdir(output, {recursive: true});
const sha = b => createHash('sha256').update(b).digest('hex');
const sourceNames = ['detectors.mjs', 'movies.mjs', 'study.mjs', 'PLAN.md'];
const sources = Object.fromEntries(await Promise.all(sourceNames.map(async name => [name, sha(await readFile(new URL(name, import.meta.url)))])));
sources['shared/vision/motion.js'] = sha(await readFile(new URL('../../../shared/vision/motion.js', import.meta.url)));
if (split === 'heldout') {
  const frozen = JSON.parse(await readFile(`${output}/candidates-frozen.json`, 'utf8'));
  for (const [name, hash] of Object.entries(sources)) if (frozen.sources[name] !== hash) throw Error(`Frozen-source mismatch: ${name}`);
}

const movieBytes = [], records = [], controls = [];
let offset = 0;
const elapsedStart = performance.now();
function run(c, frames, times, condition = 'original') {
  const event = new EngineeredDisplacementEvent(), expansion = new EngineeredSilhouetteExpansion(), baseline = new MotionOpponent();
  let previous = null;
  const trace = [];
  for (let i = 0; i < frames.length; i++) {
    const pixels = frames[i], time = times[i];
    let temporal = 0;
    if (previous) for (let j = 0; j < pixels.length; j += 4) temporal += Math.abs(pixels[j] - previous[j]) / 255 / WIDTH / HEIGHT;
    const e = event.step(pixels, time), l = expansion.step(pixels, time), b = baseline.step(pixels, time, EYE_CALIBRATION);
    trace.push({time, event: e.event, eventScore: e.score, supported: e.supported, reason: e.reason,
      displacement: e.displacement, centroid: e.centroid, loom: l.loom, radiusRate: l.radiusRate,
      radius: l.radius, expansionFit: l.expansionFit, widthRate: l.widthRate, heightRate: l.heightRate,
      baselineLoom: b.loom, baselineTemporal: temporal, temporalEvent: temporal > .0008});
    previous = pixels;
  }
  const post = trace.filter(t => t.time >= c.onset), supportedFraction = post.filter(t => t.supported).length / post.length;
  const first = key => trace.find(t => key(t))?.time ?? null;
  return {id: c.id, family: c.family, scope: c.scope, condition, supportedFraction,
    expectedEvent: c.objectEvent, expectedExpansion: c.expansion,
    event: trace.some(t => t.event), expansion: trace.some(t => t.loom > 0),
    firstEvent: first(t => t.event), firstExpansion: first(t => t.loom > 0),
    baselineEvent: trace.some(t => t.temporalEvent), baselineExpansion: trace.some(t => t.baselineLoom > 0),
    trace};
}
for (const c of cases(split, count)) {
  const times = frameTimes(c), generated = times.map(time => movieFrame(c, time));
  const frames = generated.map(f => f.pixels), bytes = Buffer.concat(generated.map(f => Buffer.from(f.gray)));
  movieBytes.push(bytes);
  const record = run(c, frames, times);
  Object.assign(record, {parameters: c, frameTimes: times, byteOffset: offset, byteLength: bytes.length, movieSha256: sha(bytes)});
  records.push(record); offset += bytes.length;
  // Every movie receives controls. No examples are selected after seeing outcomes.
  controls.push(run(c, frames.map(() => frames[0]), times, 'frozen'));
  controls.push(run(c, [...frames].reverse(), times, 'reversed'));
}
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const median = a => a.length ? [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)] : null;
const grouped = Object.fromEntries([...new Set(records.map(r => r.family))].map(family => {
  const r = records.filter(r => r.family === family), supported = r.filter(r => r.supportedFraction >= .95);
  return [family, {movies: r.length, supportedMovies: supported.length, meanFrameCoverage: mean(r.map(r => r.supportedFraction)),
    eventMovies: r.filter(r => r.event).length, expansionMovies: r.filter(r => r.expansion).length,
    conditionalEventRate: mean(supported.map(r => +r.event)), conditionalExpansionRate: mean(supported.map(r => +r.expansion)),
    temporalBaselineMovies: r.filter(r => r.baselineEvent).length, motionBaselineMovies: r.filter(r => r.baselineExpansion).length}];
}));
const rate = (families, key) => {
  const eligible = records.filter(r => families.includes(r.family) && r.supportedFraction >= .95);
  return {n: eligible.length, positives: eligible.filter(r => r[key]).length, rate: mean(eligible.map(r => +r[key]))};
};
const eventRecall = rate(['small-pass', 'small-step'], 'event'), eventFalse = rate(['large-bar', 'stationary-flicker', 'global-flash'], 'event');
const loomRecall = rate(['approach-dark', 'approach-bright'], 'expansion'), loomFalse = rate(['dimming', 'translation', 'recession'], 'expansion');
const eventDelay = median(records.filter(r => ['small-pass', 'small-step'].includes(r.family) && r.firstEvent !== null).map(r => r.firstEvent - r.parameters.onset));
const loomDelay = median(records.filter(r => ['approach-dark', 'approach-bright'].includes(r.family) && r.firstExpansion !== null).map(r => r.firstExpansion - r.parameters.onset));
const gates = {eventRecall, eventFalse, loomRecall, loomFalse, eventMedianDelay: eventDelay, loomMedianDelay: loomDelay,
  eventPass: eventRecall.n >= count * 2 * .95 && eventFalse.n >= count * 3 * .95 && eventRecall.rate >= .9 && eventFalse.rate <= .05 && eventDelay !== null && eventDelay >= 0 && eventDelay <= .3,
  expansionPass: loomRecall.n >= count * 2 * .95 && loomFalse.n >= count * 3 * .95 && loomRecall.rate >= .9 && loomFalse.rate <= .05 && loomDelay !== null && loomDelay >= 0 && loomDelay <= .3,
  physicalUsefulnessTested: false, neuralFidelityTested: false, productionPromotion: false};
const summary = {version: 1, split, countPerFamily: count, createdAt: new Date().toISOString(), sources, settings: CANDIDATE_SETTINGS,
  width: WIDTH, height: HEIGHT, storage: 'concatenated gray8 frames; byte offsets and timestamps in traces',
  movieCount: records.length, controlCount: controls.length, elapsedSeconds: (performance.now() - elapsedStart) / 1000,
  grouped, gates, controls: Object.fromEntries(['frozen', 'reversed'].map(condition => [condition, Object.fromEntries([...new Set(records.map(r => r.family))].map(family => {
    const r = controls.filter(r => r.condition === condition && r.family === family);
    return [family, {movies: r.length, eventMovies: r.filter(r => r.event).length, expansionMovies: r.filter(r => r.expansion).length}];
  }))]))};
const compressedMovies = gzipSync(Buffer.concat(movieBytes), {level: 9});
const compressedTraces = gzipSync(JSON.stringify({records, controls}), {level: 9});
summary.artifacts = {moviesSha256: sha(compressedMovies), tracesSha256: sha(compressedTraces), movieBytes: offset};
await writeFile(`${output}/candidates-${split}-movies.gray8.gz`, compressedMovies);
await writeFile(`${output}/candidates-${split}-traces.json.gz`, compressedTraces);
await writeFile(`${output}/candidates-${split}-summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
if (split === 'calibration') await writeFile(`${output}/candidates-frozen.json`, `${JSON.stringify({sources, settings: CANDIDATE_SETTINGS}, null, 2)}\n`);
console.log(JSON.stringify({split, movieCount: records.length, elapsedSeconds: summary.elapsedSeconds, gates, grouped}, null, 2));
