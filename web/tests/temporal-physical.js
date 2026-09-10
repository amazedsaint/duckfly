import {sourceHashes} from '../../experiments/temporal/source-receipt.js';
import {loadLabRuntime} from '../src/lab/lab-runtime.js';
import {Experiment} from '../src/lab/experiment.js';
import {LabArena} from '../src/lab/lab-arena.js';
import {fetchBytes} from '../src/assets.js';
import {cases, sceneFor, events, configureDrive, labelRisk} from '../../experiments/temporal/scenes.js';
import {ResearchController, CONDITIONS} from '../../experiments/temporal/control.js';
import {TemporalDecoder} from '../../experiments/temporal/decoder.js';
import validation from '../../experiments/temporal/models/v1/validation.json';
import temporalModel from '../../experiments/temporal/models/v1/temporal.json';
import staticModel from '../../experiments/temporal/models/v1/static.json';
import noPoseModel from '../../experiments/temporal/models/v1/no-pose.json';
const params = new URLSearchParams(location.search), split = params.get('split') ?? 'physical', seeds = Number(params.get('seeds') ?? 16), run = params.get('run') ?? `temporal-${split}-v1`;
const status = document.querySelector('#status'), progress = document.querySelector('#progress');
async function retain(event, data) {const r = await fetch('/__temporal', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({run, event, data})}); if (!r.ok) throw Error(await r.text());}
try {
  const decoderName = params.get('decoder') ?? 'temporal';
  if (!['temporal', 'no-pose'].includes(decoderName) || !validation.models[decoderName].perceptionGate) throw Error('Perception gate failed: physical promotion study is locked');
  const artifact = decoderName === 'temporal' ? temporalModel : noPoseModel;
  const artifactHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(artifact)))), v => v.toString(16).padStart(2, '0')).join('');
  const decoders = {temporal: new TemporalDecoder(artifact), static: new TemporalDecoder(staticModel)};
  const runtime = await loadLabRuntime(location.origin + '/', message => status.textContent = message), bytes = await fetchBytes('/assets/scene.json.gz');
  const arena = new LabArena(document.querySelector('#arena'), JSON.parse(new TextDecoder().decode(bytes))); arena.renderer.setAnimationLoop(null);
  const all = cases(split, seeds), conditions = params.has('conditions') ? params.get('conditions').split(',') : CONDITIONS;
  if (conditions.some(c => !CONDITIONS.includes(c))) throw Error('Unknown condition');
  await retain('start', {format: 'duckfly-temporal-physical',sourceGuardVersion:1,sourceHashes:{...sourceHashes,'web/tests/temporal-physical.js':__researchModuleHash}, split, seeds, conditions, decoderName, artifactHash, artifactHashEncoding: 'JSON.stringify(parsed artifact), UTF-8', expectedTrials: all.length * conditions.length, trainSha256: validation.trainSha256, validationSha256: validation.validationSha256});
  const started = performance.now(); let done = 0;
  for (const c of all) for (const condition of conditions) {
    const e = new Experiment(runtime, sceneFor(c)); configureDrive(e, c); arena.setScene(e.scene);
    const decoder = condition.startsWith('temporal') ? decoders.temporal : condition === 'static-hazard' ? decoders.static : null;
    const controller = new ResearchController(e, condition, decoder), trace = [], initial = e.world.state().ducks[0].position;
    try {
      for (let tick = 0; tick < 250; tick++) {
        events(e, c, tick); let packets = null; const before = e.world.state();
        if (e.needsFrames()) {
          arena.updateLab(before); packets = arena.captureEyes(tick * .02, tick);
          controller.observe(packets['duck-1'], before.ducks[0], e.scene.ducks[0].eye);
        }
        const label = labelRisk(e), result = await e.step(packets), body = result.body.ducks[0];
        trace.push({time: tick * .02, risk: controller.risk, truth: label.risk, position: body.position, heading: body.heading, speed: body.speed,
          contacts: result.body.collisionCount, fallen: body.fallen, command: result.event.causes[0].command,
          ...controller.last, neuralTime: result.agents['duck-1'].neural.neuralTime});
      }
      const final = e.world.state(), body = final.ducks[0];
      await retain('trial', {id: c.id, family: c.family, condition, case: c, trace,
        summary: {contact: final.collisionCount > 0, contacts: final.collisionCount, fallen: body.fallen, progress: body.position[0] - initial[0],
          gf: trace.some(t => t.gfEvent), heldSeconds: trace.filter(t => t.held).length * .02, releases: controller.feedback?.state.releases ?? 0}});
    } finally {e.dispose();}
    done++; status.textContent = `${done}/${all.length * conditions.length} · ${c.family} · ${condition}`;
    progress.textContent = JSON.stringify({run, elapsedSeconds: (performance.now() - started) / 1000}); arena.renderer.render(arena.scene, arena.camera); await new Promise(r => setTimeout(r, 0));
  }
  await retain('complete', {complete: true, elapsedSeconds: (performance.now() - started) / 1000}); status.textContent = `Complete: ${run}`;
} catch (e) {status.textContent = 'ERROR: ' + e.stack;}
