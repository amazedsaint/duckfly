import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {gzipSync} from 'node:zlib';
import {fetchBytes, fetchJSON} from '../src/assets.js';
import {browserSupport} from '../src/startup.js';

const payload = Buffer.from(JSON.stringify({duck: 'Microduck', signals: [0.1, 0.7]}));
const compressed = gzipSync(payload);

test('asset loading handles gzip, decoded responses, missing and broken native decompression', async t => {
  const fetchOriginal = globalThis.fetch, native = globalThis.DecompressionStream;
  t.after(() => { globalThis.fetch = fetchOriginal; globalThis.DecompressionStream = native; });
  globalThis.fetch = async () => new Response(compressed);
  assert.deepEqual(await fetchJSON('/model.gz'), JSON.parse(payload));
  globalThis.DecompressionStream = undefined;
  assert.deepEqual(await fetchBytes('/model.gz'), new Uint8Array(payload));
  globalThis.DecompressionStream = class { constructor() { throw Error('Native gzip failure'); } };
  assert.deepEqual(await fetchBytes('/model.gz'), new Uint8Array(payload));
  globalThis.fetch = async () => new Response(payload);
  assert.deepEqual(await fetchBytes('/already-decoded.gz'), new Uint8Array(payload));
  globalThis.fetch = async () => new Response('missing', {status: 404});
  await assert.rejects(fetchBytes('/missing', {label: 'Robot appearance'}), /Robot appearance.*404/);
  globalThis.fetch = async () => new Response(compressed.subarray(0, 12));
  await assert.rejects(fetchBytes('/truncated.gz'));
});

test('downloads time out when stalled, but keep receiving slow streams and honor cancellation', async t => {
  const server = createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'application/octet-stream'});
    res.write('a');
    if (req.url === '/slow') {
      let count = 0;
      const timer = setInterval(() => { res.write('b'); if (++count === 12) { clearInterval(timer); res.end(); } }, 15);
      res.on('close', () => clearInterval(timer));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`, progress = [];
  await assert.rejects(fetchBytes(base + '/stalled', {timeoutMs: 80, label: 'Robot physics'}), /Robot physics stopped downloading/);
  const bytes = await fetchBytes(base + '/slow', {timeoutMs: 80, onProgress: value => progress.push(value)});
  assert.equal(bytes.length, 13);
  assert.ok(progress.length > 0);
  const controller = new AbortController();
  const pending = fetchBytes(base + '/cancel', {signal: controller.signal, timeoutMs: 5000});
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, error => error.name === 'AbortError');
});

test('compatibility probe validates the actual SIMD feature and handles disabled WebAssembly', () => {
  const scope = {WebAssembly, Worker: class {}, WebGL2RenderingContext: class {}, structuredClone};
  assert.ok(Object.values(browserSupport(scope)).every(Boolean));
  assert.equal(browserSupport({...scope, WebAssembly: undefined}).wasmSIMD, false);
  assert.equal(browserSupport({...scope, WebAssembly: {validate() { throw Error('Disabled'); }}}).wasmSIMD, false);
  assert.equal(browserSupport({...scope, Worker: undefined}).workers, false);
});
