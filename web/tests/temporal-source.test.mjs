import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {repo, commonSources, hash, sourceGuardPlugin, validateSources} from '../../experiments/temporal/source-guard.mjs';

test('served modules carry the digest of their actual source', () => {
  const plugin = sourceGuardPlugin(), path = resolve(repo, 'experiments/temporal/scenes.js');
  const oldSource = 'export const revision = 1;', newSource = 'export const revision = 2;';
  assert.ok(plugin.transform(oldSource, path).code.includes(hash(oldSource)));
  assert.ok(!plugin.transform(oldSource, path).code.includes(hash(newSource)));
  assert.equal(plugin.transform(oldSource, resolve(repo, 'unrelated.js')), null);
});

test('a missing or cached source receipt cannot start another study', async () => {
  const harness = 'web/tests/temporal-harness.js', sources = {};
  for (const path of [...commonSources, harness]) sources[path] = hash(await readFile(resolve(repo, path), 'utf8'));
  const data = {format: 'duckfly-temporal-data', sourceGuardVersion: 1, sourceHashes: sources};
  const receipt = await validateSources(data);
  assert.equal(Object.keys(receipt.sources).length, commonSources.length + 1);
  await assert.rejects(validateSources({...data, sourceHashes: undefined}), /receipt required/);
  const stale = {...sources, 'experiments/temporal/scenes.js': '0'.repeat(64)};
  await assert.rejects(validateSources({...data, sourceHashes: stale}), /Stale research module/);
});

test('physical receipts also check the loaded decoder artifact', async () => {
  const sources = {};
  for (const path of [...commonSources, 'web/tests/temporal-physical.js']) sources[path] = hash(await readFile(resolve(repo, path), 'utf8'));
  const artifact = JSON.parse(await readFile(resolve(repo, 'experiments/temporal/models/v1/no-pose.json'), 'utf8'));
  const data = {format: 'duckfly-temporal-physical', sourceGuardVersion: 1, sourceHashes: sources, decoderName: 'no-pose', artifactHash: hash(JSON.stringify(artifact))};
  await validateSources(data);
  await assert.rejects(validateSources({...data, artifactHash: '0'.repeat(64)}), /Stale decoder artifact/);
});
