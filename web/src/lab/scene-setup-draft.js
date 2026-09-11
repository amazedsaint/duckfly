import { validateScene, COLORS } from './scene.js';
import { propProfile } from './prop-behavior.js';

export const SETUP_MODES = [
  ['target', 'Follow a beacon', 'A pink beacon in the camera image supplies input to the fly circuit.'],
  ['flock', 'Follow other ducks', 'Blue markings on other ducks supply input to this duck’s fly circuit.'],
  ['brain', 'Brain stimulation', 'Send signals directly with the brain controls. Some scene presets also supply a continuous input.'],
  ['light', 'Seek brightness', 'Brightness in the eye image supplies the neural input.'],
  ['odor', 'Follow a scent', 'A simulated scent field supplies the neural input instead of a visual target.'],
  ['manual', 'Manual control', 'You issue movement commands directly. Your connections are saved but inactive in this mode.'],
  ['reactive', 'Compare: camera rules', 'A simple image rule controls movement directly, bypassing the fly circuit.'],
  ['reflex', 'Compare: motion reflex', 'Image motion controls movement directly, bypassing the fly circuit.'],
];

export const cloneSetupScene = scene => structuredClone(validateScene(scene));
export const setupEntity = (scene, id) => [...scene.ducks, ...scene.props, ...scene.fields].find(entity => entity.id === id);

function nextId(scene, prefix) {
  const ids = new Set([...scene.ducks, ...scene.props, ...scene.fields].map(entity => entity.id));
  let suffix = 1;
  while (ids.has(`${prefix}-${suffix}`)) suffix++;
  return `${prefix}-${suffix}`;
}

function freePosition(scene, duck = false, radius = .1) {
  if(duck)radius=.16;
  const clear = position => scene.ducks.every(d => Math.hypot(d.spawn[0]-position[0],d.spawn[1]-position[1]) > radius+.19) && scene.props.every(p => {
    const dx=position[0]-p.position[0],dy=position[1]-p.position[1];
    if(p.kind==='ball'||p.kind==='target')return Math.hypot(dx,dy)>radius+p.size[0]/2+.04;
    const c=Math.cos(p.yaw??0),s=Math.sin(p.yaw??0),localX=dx*c+dy*s,localY=-dx*s+dy*c;
    return Math.hypot(Math.max(0,Math.abs(localX)-p.size[0]/2),Math.max(0,Math.abs(localY)-p.size[1]/2))>radius+.04;
  });
  // A separate lane keeps additions from spawning inside a configured object.
  for (let row = 0; row < 20; row++) for (let col = 0; col < 12; col++) {
    const position = [duck ? -.4 - col * .4 : .45 + col * .3, -.35 - row * .35];
    if (clear(position)) return position;
  }
  for(let y=-8;y<=8;y+=.4)for(let x=-8;x<=8;x+=.4)if(clear([x,y]))return [x,y];
  throw Error('There is no clear starting position. Move an object before adding another.');
}

export function addSetupDuck(scene) {
  if (scene.ducks.length >= 8) throw Error('A scene can have up to 8 ducks.');
  const id = nextId(scene, 'duck');
  scene.ducks.push({id, name: `Duck ${id.split('-').at(-1)}`, spawn: [...freePosition(scene, true), 0], mode: 'target', mapping: {forward: 'walk', turn: 'follow'}});
  const normalized = validateScene({...scene, version: 6});
  Object.assign(scene, normalized);
  return id;
}

export function addSetupProp(scene, kind) {
  if (scene.props.length >= 40) throw Error('A scene can have up to 40 objects.');
  if (!['target', 'ball', 'block', 'wall'].includes(kind)) throw Error('Unknown object type.');
  const id = nextId(scene, kind), size = kind === 'wall' ? [.06, .4, .3] : kind === 'target' ? [.09, .09, .09] : [.12, .12, .12];
  const radius=kind==='ball'||kind==='target'?size[0]/2:Math.hypot(size[0],size[1])/2;
  scene.props.push({id, kind, name: {target:'Beacon', ball:'Ball', block:'Block', wall:'Wall'}[kind], position: [...freePosition(scene,false,radius), kind === 'target' ? .14 : size[2] / 2], size, color: COLORS[kind], ...propProfile(kind === 'ball' ? 'pushable' : 'fixed')});
  Object.assign(scene, validateScene(scene));
  return id;
}

export function addSetupField(scene, kind) {
  if (scene.fields.length >= 16) throw Error('A scene can have up to 16 sensory fields.');
  if (!['odor', 'light'].includes(kind)) throw Error('Unknown sensory field.');
  const id = nextId(scene, kind);
  let index=0;
  while(scene.fields.some(f=>Math.hypot(f.position[0]-(.8+(index%4)*.4),f.position[1]-(-.4-Math.floor(index/4)*.4))<.2))index++;
  scene.fields.push({id, kind, position: [.8+(index%4)*.4,-.4-Math.floor(index/4)*.4], strength: 1, radius: .5});
  return id;
}

export function removeSetupEntity(scene, id) {
  if (scene.ducks.some(d => d.id === id) && scene.ducks.length === 1) throw Error('Keep at least one duck in the scene.');
  for (const key of ['ducks', 'props', 'fields']) scene[key] = scene[key].filter(entity => entity.id !== id);
  if (scene.challenge.subject === id) scene.challenge.subject = 'ducks';
  if (id === 'object' && scene.lab?.id === 'stop-go') scene.lab.scripted = false;
}

export function setSetupProfile(scene, id, profile) {
  const prop = scene.props.find(p => p.id === id);
  if (!prop) throw Error('Select an object first.');
  Object.assign(prop, propProfile(profile, {speed: prop.behavior?.speed, range: prop.behavior?.range, axis: prop.behavior?.axis}));
  if (scene.lab?.id === 'stop-go' && prop.id === 'object') scene.lab.scripted = false;
}

export function setSetupValue(scene, id, path, value) {
  const entity = setupEntity(scene, id);
  if (!entity) throw Error('Select a duck or object first.');
  // Paths are UI-owned, but keep the pure helper safe for accidental callers too.
  if (!/^(name|spawn\.[012]|position\.[012]|size\.[012]|yaw|mass|friction|color|motion\.[012]|behavior\.(speed|range|axis)|strength|radius|mode|source|visionModel|gfGain|headStabilization|temporal|activeLook|flowSteer|feedback|motorEnabled|motorGain|eye|silence|manual\.[01]|adapter\.(forward|turn|flow|field)|mapping\.(forward|turn))$/.test(path)) throw Error('Unknown setup setting.');
  const keys = path.split('.');
  let target = entity;
  for (const key of keys.slice(0, -1)) target = target[key];
  target[keys.at(-1)] = value;
  if (entity.id === 'object' && scene.lab?.id === 'stop-go' && /^(position|motion|behavior|size|yaw)/.test(path)) scene.lab.scripted = false;
}

export function setupWarnings(scene, original) {
  const warnings = [];
  if (original.lab?.scripted && scene.lab?.id === 'stop-go' && !scene.lab.scripted) warnings.push('Your object settings replace the preset encounter path. Its brain input and stop-loop condition are preserved.');
  if (scene.ducks.some(d => d.mode === 'target') && !scene.props.some(p => p.kind === 'target')) warnings.push('Beacon-following ducks need a visible pink cue. Add a beacon or choose another behavior.');
  if (scene.ducks.some(d => d.mode === 'flock') && scene.ducks.length < 2) warnings.push('Following companions needs another duck.');
  if (scene.ducks.some(d => d.source === 'webcam')) warnings.push('Webcam vision needs camera access after launch. The camera image replaces the duck’s simulated view.');
  if (scene.ducks.some(d => d.eye === 'none' || d.silence !== 'none' || !d.motorEnabled || !d.motorGain)) warnings.push('Some vision or movement pathways are disabled. Check Advanced settings if the duck stays still.');
  return warnings;
}
