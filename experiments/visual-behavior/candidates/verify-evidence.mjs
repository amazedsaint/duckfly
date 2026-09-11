import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {EngineeredDisplacementEvent, EngineeredSilhouetteExpansion, WIDTH, HEIGHT} from './detectors.mjs';
import {grayToRgba} from './movies.mjs';

const sha = b => createHash('sha256').update(b).digest('hex'), root = new URL('../reports/', import.meta.url);
const receipts = [];
for (const split of ['calibration', 'heldout']) {
  const summary = JSON.parse(await readFile(new URL(`candidates-${split}-summary.json`, root)));
  const movieBytes = await readFile(new URL(`candidates-${split}-movies.gray8.gz`, root));
  const traceBytes = await readFile(new URL(`candidates-${split}-traces.json.gz`, root));
  assert.equal(sha(movieBytes), summary.artifacts.moviesSha256);
  assert.equal(sha(traceBytes), summary.artifacts.tracesSha256);
  const movies = gunzipSync(movieBytes), data = JSON.parse(gunzipSync(traceBytes));
  assert.equal(movies.length, summary.artifacts.movieBytes);
  assert.equal(data.records.length, summary.movieCount);
  assert.equal(new Set(data.records.map(r => r.id)).size, data.records.length);
  let frames = 0;
  for (const r of data.records) {
    const bytes = movies.subarray(r.byteOffset, r.byteOffset + r.byteLength);
    assert.equal(bytes.length, r.frameTimes.length * WIDTH * HEIGHT);
    assert.equal(sha(bytes), r.movieSha256);
    const event = new EngineeredDisplacementEvent(), loom = new EngineeredSilhouetteExpansion();
    for (let i = 0; i < r.frameTimes.length; i++) {
      const pixels = grayToRgba(new Uint8Array(bytes.subarray(i * WIDTH * HEIGHT, (i + 1) * WIDTH * HEIGHT)));
      const e = event.step(pixels, r.frameTimes[i]), l = loom.step(pixels, r.frameTimes[i]), retained = r.trace[i];
      assert.equal(e.event, retained.event); assert.equal(e.score, retained.eventScore);
      assert.equal(e.supported, retained.supported); assert.equal(l.loom, retained.loom);
      assert.equal(l.radiusRate, retained.radiusRate); frames++;
    }
  }
  for (const r of data.controls.filter(r => r.condition === 'frozen')) {assert.equal(r.event, false); assert.equal(r.expansion, false);}
  receipts.push({split, movies: data.records.length, replayedFrames: frames, exactDecisions: true, hashes: true});
}
const a = JSON.parse(gunzipSync(await readFile(new URL('candidates-calibration-traces.json.gz', root))));
const b = JSON.parse(gunzipSync(await readFile(new URL('candidates-heldout-traces.json.gz', root))));
const ids = new Set(a.records.map(r => r.id)), movieHashes = new Set(a.records.map(r => r.movieSha256));
assert.ok(b.records.every(r => !ids.has(r.id) && !movieHashes.has(r.movieSha256)));
const report = {version: 1, receipts, independentMovieIdsAndHashes: true, productionPromotion: false};
await writeFile(new URL('candidates-verification.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
