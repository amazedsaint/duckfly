import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { neuralFlowCoverage } from './neural-flow-coverage.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
for (const name of ['neural-flow-v1', 'neural-flow-v2']) {
  const directory = path.join(here, 'reports', name), file = path.join(directory, 'summary.json');
  const bytes = fs.readFileSync(file), summary = JSON.parse(bytes);
  if (summary.coverageAnnotation) { console.log(`${name}: coverage already annotated`); continue; }
  const records = JSON.parse(gunzipSync(fs.readFileSync(path.join(directory, 'trials.json.gz'))));
  const coverage = neuralFlowCoverage(records.map(record => record.spec));
  const original = 'summary.pre-coverage.json';
  fs.writeFileSync(path.join(directory, original), bytes, { flag: 'wx' });
  summary.generatorCoverage = coverage;
  summary.coverageAnnotation = {
    addedAt: new Date().toISOString(), addedAfterExecution: true,
    sourceSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    checkerSha256: sha256(fs.readFileSync(path.join(here, 'neural-flow-coverage.mjs'))),
    originalSummary: original, originalSummarySha256: sha256(bytes),
    admissionBeforeCoverageAudit: summary.gates.rendererAdmission,
    finding: 'Adjacent LCG seeds covered only a narrow first-draw wavelength interval. Original measured outcomes remain intact. Broad-frequency admission requires a separately identified stratified confirmation.',
  };
  summary.gates.generatorCoverage = coverage.passed;
  summary.gates.rendererAdmission = summary.gates.rendererAdmission && coverage.passed;
  summary.evidence[original] = { sha256: sha256(bytes), bytes: bytes.length };
  fs.writeFileSync(file, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ name, actualWavelength: coverage.parameters.wavelength.actualInterval,
    originalMeasuredGates: JSON.parse(bytes).gates, broadAdmission: summary.gates.rendererAdmission }));
}
