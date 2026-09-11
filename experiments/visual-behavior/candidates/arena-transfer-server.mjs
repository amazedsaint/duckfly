import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url)), reports = fileURLToPath(new URL('../reports/', import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const files = ['arena-transfer-browser.mjs', 'arena-transfer-server.mjs', 'detectors.mjs'];
const sources = Object.fromEntries(await Promise.all(files.map(async f => [f, sha(await readFile(root + f))])));
for (const path of ['web/src/arena.js', 'web/src/lab/lab-arena.js', 'web/src/lab/lab-world.js', 'web/src/lab/scene.js']) sources[path] = sha(await readFile(new URL('../../../' + path, import.meta.url)));
await mkdir(reports, {recursive: true});
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5182');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  try {
    if (req.method === 'OPTIONS') {res.writeHead(204); res.end(); return;}
    if (req.method === 'GET' && files.includes(req.url.slice(1))) {
      res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(root + req.url.slice(1))); return;
    }
    if (req.method !== 'POST' || req.url !== '/result') {res.writeHead(404); res.end(); return;}
    let size = 0; const chunks = [];
    for await (const chunk of req) {size += chunk.length; if (size > 24_000_000) throw Error('Probe body too large'); chunks.push(chunk);}
    const record = JSON.parse(Buffer.concat(chunks)), count = record.records?.length;
    if (record.probe !== 'actual-default-LabArena-posed-camera' || count !== 12 || record.records.some(r => r.frames.length !== 31)) throw Error('Incomplete arena probe');
    const compressed = gzipSync(JSON.stringify({...record, sources}), {level: 9});
    const groups = Object.fromEntries([...new Set(record.records.map(r => r.family))].map(family => {
      const r = record.records.filter(r => r.family === family), frames = r.flatMap(r => r.frames);
      return [family, {movies: r.length, frames: frames.length, supportedFrames: frames.filter(f => f.event.supported).length,
        eventMovies: r.filter(r => r.frames.some(f => f.event.event)).length,
        expansionMovies: r.filter(r => r.frames.some(f => f.expansion.event)).length}];
    }));
    const summary = {probe: record.probe, interpretation: record.interpretation, sources, movies: count, frames: count * 31,
      recordsSha256: sha(compressed), groups, productionPromotion: false};
    await writeFile(reports + 'candidates-arena-transfer.json.gz', compressed);
    await writeFile(reports + 'candidates-arena-transfer-summary.json', JSON.stringify(summary, null, 2) + '\n');
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(summary));
  } catch (e) {res.writeHead(400); res.end(e.message);}
});
server.listen(0, '127.0.0.1', () => console.log(`Candidate transfer collector http://127.0.0.1:${server.address().port}`));
