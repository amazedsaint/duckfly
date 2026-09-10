import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, relative} from 'node:path';
export const repo = fileURLToPath(new URL('../../', import.meta.url));
export const commonSources = [
  'experiments/temporal/scenes.js', 'experiments/temporal/features.js', 'experiments/temporal/control.js',
  'experiments/temporal/decoder.js', 'experiments/temporal/feedback.js',
  'experiments/feedback/rotation-motion.js', 'experiments/feedback/candidates.js',
  'web/src/brain.js', 'web/src/vendor/desktop-fly/sim.js', 'web/src/lab/experiment.js',
  'web/src/lab/lab-world.js', 'web/src/lab/lab-arena.js', 'web/src/lab/vision.js',
  'web/src/lab/visual-system.js', 'web/src/lab/scene.js', 'web/src/world.js',
];
const harnesses = ['web/tests/temporal-harness.js', 'web/tests/temporal-physical.js'];
const tracked = new Set([...commonSources, ...harnesses]);
export const hash = value => createHash('sha256').update(value).digest('hex');
export function sourceGuardPlugin() {
  return {name: 'executed-research-source-hashes', enforce: 'pre', transform(code, id) {
    if (!tracked.has(relative(repo, id.split('?')[0]))) return null;
    // The exported digest travels with the compiled module, including a cached copy.
    return {code: `export const __researchModuleHash = '${hash(code)}';\n${code}`, map: null};
  }};
}
export async function validateSources(data) {
  const harness = data.format === 'duckfly-temporal-data' ? harnesses[0] : data.format === 'duckfly-temporal-physical' ? harnesses[1] : null;
  const expected = [...commonSources, harness];
  if (!harness || data.sourceGuardVersion !== 1 || !data.sourceHashes || Object.keys(data.sourceHashes).length !== expected.length) throw Error('Executed source receipt required; restart the research server and reload the harness');
  const sources = {};
  for (const path of expected) {
    const code = await readFile(resolve(repo, path), 'utf8'), digest = hash(code);
    if (data.sourceHashes[path] !== digest) throw Error(`Stale research module: ${path}. Restart the server before a new study.`);
    sources[path] = {sha256: digest, code};
  }
  if (harness === harnesses[1]) {
    if (!['temporal', 'no-pose'].includes(data.decoderName)) throw Error('Unknown decoder');
    const artifact = JSON.parse(await readFile(resolve(repo, `experiments/temporal/models/v1/${data.decoderName}.json`), 'utf8'));
    if (data.artifactHash !== hash(JSON.stringify(artifact))) throw Error('Stale decoder artifact');
  }
  return {version: 1, sources};
}
