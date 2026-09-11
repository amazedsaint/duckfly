// Additional rendered transfer cohort for the frozen DD readout. Only posed
// camera/props vary; actual default scene materials, floor and lights are used.
const BASE = 'http://127.0.0.1:5182/';
export async function runArenaDD() {
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
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;width:960px;height:640px;background:white'; document.body.append(host);
  const arena = new LabArena(host, data); arena.renderer.setAnimationLoop(null);
  const records = [], families = ['target-pass', 'small-step', 'large-bar', 'stationary-flicker', 'local-dimming', 'global-dimming', 'camera-pan-empty', 'camera-pan-static-target', 'target-pass-camera-pan', 'target-pass-clutter', 'static-target'];
  for (const family of families) for (let index = 0; index < 6; index++) {
    const scene = defaultScene('target'), p = scene.props[0];
    const direction = index % 2 ? -1 : 1, distance = [.55, .75, .95][index % 3], diameter = [.045, .075, .12][Math.floor(index / 2)];
    p.position = [distance, direction * -.08, .17]; p.size = [diameter, diameter, diameter];
    p.color = index % 2 ? '#ee4581' : '#18221f';
    if (family === 'large-bar') {p.kind = 'block'; p.size = [.05, .06, .32];}
    if (family === 'target-pass-clutter') for (let j = 0; j < 4; j++) scene.props.push({...structuredClone(p), id: `clutter-${j}`, name: 'Clutter', kind: j % 2 ? 'block' : 'ball', position: [distance + .12 + .08 * j, -.3 + .18 * j, .09], size: [.1, .1, .18], color: ['#e7be34','#438bac','#789751','#a878aa'][j]});
    const world = new LabWorld(mj, template, null, null, scene); arena.setScene(scene);
    const baseColor = arena.props.get(p.id).material.color.clone(), frames = [];
    try {
      for (let i = 0; i <= 30; i++) {
        const time = i * .04, phase = Math.max(0, time - .24), pos = [...p.position];
        if (['target-pass','large-bar','target-pass-camera-pan','target-pass-clutter'].includes(family)) pos[1] += direction * phase * (.2 + .05 * (index % 3));
        if (family === 'small-step' && time >= .24) pos[1] += direction * .045;
        world.moveProp(p.id, pos, 0);
        const state = world.state(), cameraYaw = family.includes('camera-pan') ? direction * phase * .32 : 0;
        if (cameraYaw) {
          const pose = state.ducks[0].cameraPose, [w,x,y,z] = pose.slice(3), c = Math.cos(cameraYaw/2), s = Math.sin(cameraYaw/2);
          pose.splice(3,4,c*w-s*z,c*x-s*y,c*y+s*x,c*z+s*w);
        }
        arena.updateLab(state);
        const mesh = arena.props.get(p.id); mesh.visible = family !== 'camera-pan-empty'; mesh.material.color.copy(baseColor);
        if (family === 'stationary-flicker') mesh.material.color.multiplyScalar(time < .24 ? 1 : .5 + .5 * Math.cos(2 * Math.PI * [2,4,6][index % 3] * phase));
        if (family === 'local-dimming') mesh.material.color.multiplyScalar(1 - Math.min(.9, phase));
        if (family === 'global-dimming') {
          arena.key.intensity = 3.5 * (1 - Math.min(.9, phase));
          arena.scene.children.find(c => c.isHemisphereLight).intensity = 2.5 * (1 - Math.min(.9, phase));
        }
        const packet = arena.captureEyes(time,i)['duck-1'];
        frames.push({time, rgba:btoa(String.fromCharCode(...packet.pixels)), cameraPose:packet.pose, cameraYaw});
      }
      records.push({id:`arena-dd-v1-${family}-${index}`,family,index,scene,frames});
    } finally {world.dispose();}
  }
  arena.renderer.render(arena.scene,arena.camera);
  const payload = {version:1,probe:'actual-arena-dd-transfer-v1',createdAt:new Date().toISOString(),
    interpretation:'Actual LabArena render with posed prop and camera motion; no body-controller or behavioral-usefulness test. Colors, angular size, distance and direction varied by fixed cohort recipe.',records};
  const response=await fetch(new URL('./result',import.meta.url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  if (!response.ok) throw Error(await response.text()); return response.json();
}
