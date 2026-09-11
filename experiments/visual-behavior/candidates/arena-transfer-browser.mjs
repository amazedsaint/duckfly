// A posed-scene transfer probe using the actual LabArena renderer and MuJoCo
// initial camera pose. No policy inference, neural stimulation or app edits.
const BASE = 'http://127.0.0.1:5182/';
import {EngineeredDisplacementEvent, EngineeredSilhouetteExpansion} from './detectors.mjs';

export async function runArenaTransfer() {
  const [{LabArena}, {LabWorld, mountTemplate}, {defaultScene}, {fetchBytes}, {default: load}] = await Promise.all([
    import(BASE + 'src/lab/lab-arena.js'), import(BASE + 'src/lab/lab-world.js'),
    import(BASE + 'src/lab/scene.js'), import(BASE + 'src/assets.js'), import(BASE + 'runtime/mujoco.js'),
  ]);
  const [mj, dataBytes, templateBytes] = await Promise.all([
    load({locateFile: name => BASE + 'runtime/' + name}), fetchBytes(BASE + 'assets/scene.json.gz'),
    fetchBytes(BASE + 'assets/Simulation/lab-template.json.gz'),
  ]);
  const data = JSON.parse(new TextDecoder().decode(dataBytes)), template = JSON.parse(new TextDecoder().decode(templateBytes));
  mountTemplate(mj, template);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;width:960px;height:640px;z-index:10000;background:white';
  document.body.append(host);
  const arena = new LabArena(host, data); arena.renderer.setAnimationLoop(null);
  const records = [];
  const families = ['target-pass', 'large-bar', 'approach', 'recession', 'lighting-change', 'static-target'];
  for (const family of families) for (let index = 0; index < 2; index++) {
    const scene = defaultScene('target');
    const p = scene.props[0], y = (index ? 1 : -1) * .08;
    p.position = [.65, y, .17]; p.size = [.075, .075, .075];
    if (family === 'large-bar') {p.kind = 'block'; p.size = [.035, .06, .3];}
    if (['approach', 'recession'].includes(family)) {p.kind = 'ball'; p.size = [.14, .14, .14];}
    const world = new LabWorld(mj, template, null, null, scene);
    arena.setScene(scene);
    const event = new EngineeredDisplacementEvent(), expansion = new EngineeredSilhouetteExpansion(), frames = [];
    try {
      for (let i = 0; i <= 30; i++) {
        const time = i * .04, phase = Math.max(0, time - .24);
        let position = [...p.position];
        if (['target-pass', 'large-bar'].includes(family)) position[1] += (index ? -1 : 1) * phase * .3;
        if (family === 'approach') position[0] = .85 - phase * .52;
        if (family === 'recession') position[0] = .35 + phase * .52;
        world.moveProp(p.id, position, 0); arena.updateLab(world.state());
        arena.key.intensity = family === 'lighting-change' ? 3.5 - Math.min(3.0, phase * 3.5) : 3.5;
        const packet = arena.captureEyes(time, i)['duck-1'];
        const e = event.step(packet.pixels, time), l = expansion.step(packet.pixels, time);
        frames.push({time, rgba: btoa(String.fromCharCode(...packet.pixels)), cameraPose: packet.pose,
          event: e, expansion: l});
      }
      records.push({id: `arena-transfer-${family}-${index}`, family, index, scene, frames});
    } finally {world.dispose();}
  }
  arena.renderer.render(arena.scene, arena.camera);
  const result = {version: 1, probe: 'actual-default-LabArena-posed-camera', createdAt: new Date().toISOString(),
    interpretation: 'Actual renderer and MuJoCo initial body/camera pose; props moved geometrically. No physical motion or usefulness test.',
    records};
  const response = await fetch(new URL('./result', import.meta.url), {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(result)});
  if (!response.ok) throw Error(await response.text());
  return await response.json();
}
