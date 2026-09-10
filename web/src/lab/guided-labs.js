// Playable examples from the retained study. They are demonstrations, not new
// held-out evidence. Geometry never enters the online temporal decoder.
export const LAB_IDS = ['stop-go', 'gaze', 'switchboard', 'recovery', 'kick'];
export const STOP_CASES = ['incoming', 'near-miss', 'receding', 'retreat'];
export const STOP_MODES = ['hold', 'timer', 'gf-off'];

// Fixed examples from the confirm study, including a known false alarm.
function random(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296;};
}
export function stopCase(family) {
  const index = family === 'near-miss' ? 15 : family === 'retreat' ? 0 : 1;
  const id = `tv-confirm-${family}-${index}`, r = random(id);
  return {id, family, index, sign: index % 2 ? 1 : -1, color: index % 2 ? '#e8e8e8' : '#242424', x: 1.05+r()*.2, y: (r()-.5)*.06, size: .13+r()*.09,
    speed: .23+r()*.08, phase: r()*Math.PI*2, shape: r()<.5?'ball':'block',
    pause: 1.2+r()*1.4, head: .08+r()*.14, background: .58+r()*.25};
}
export function guidedScene(id, {variant = 'incoming', condition = 'hold'} = {}) {
  const scene = {version: 2, name: '', seed: `play-${id}`, lab: {id, variant, condition, scripted: true},
    ducks: [{id: 'duck-1', name: 'Duck 1', spawn: [0,0,0], mode: 'target'}],
    props: [{id: 'target-1', name: 'Beacon', kind: 'target', position: [.9,0,.13], size: [.07,.07,.07]}]};
  if (id === 'gaze') {
    scene.name = 'Find it again'; scene.ducks[0].activeLook = true;
    scene.props[0].position = [.75,.35,.13];
    scene.props.push({id: 'wall-1', name: 'Hideaway', kind: 'wall', position: [.45,-.48,.17], size: [.045,.25,.34]});
  }
  if (id === 'switchboard') {scene.name = 'Brain switchboard'; scene.props[0].position = [.85,.25,.13];}
  if (id === 'recovery') {scene.name = 'Bump and recover'; scene.props[0].position = [1.2,0,.13]; scene.props[0].size = [.12,.12,.12];}
  if (id === 'kick') {
    scene.name='See it, kick it';scene.ducks[0].kickOnSight=true;
    scene.props[0].position=[.7,0,.14];scene.props[0].size=[.09,.09,.09];
    scene.props.push({id:'kick-ball',name:'Kick ball',kind:'ball',position:[.09,.042,.035],size:[.07,.07,.07],movable:true,mass:.025,friction:.6});
  }
  if (id === 'stop-go') {
    const c = stopCase(variant);
    scene.name = 'Stop, wait, go'; scene.seed = c.id; scene.challenge = {duration: 5, goal: [1.5,0]};
    Object.assign(scene.ducks[0], {mode: 'brain', visionModel: 'motion-opponency-v1',
      temporal: condition === 'timer' ? 'timer' : 'hold', silence: condition === 'gf-off' ? 'gf' : 'none'});
    let position = [c.x,c.y,.16], motion = [-c.speed,0,0];
    if (variant === 'near-miss') position[1] = c.sign * (.36 + Math.abs(c.y));
    if (variant === 'retreat') {position = [.52+c.x-1.05,c.y,.16]; motion = [0,0,0];}
    if (variant === 'receding') {position = [.48+c.x-1.05,c.y,.16]; motion = [c.speed+.15,0,0];}
    scene.props = [{id: 'object', name: 'Test object', kind: c.shape, position, motion, size: [c.size,c.size,c.size], color: c.color},
      {id: 'bg-a', kind: 'block', name: 'Backdrop A', position: [1.4,c.background,.19], size: [.14,.16,.38], color: '#8d938d'},
      {id: 'bg-b', kind: 'block', name: 'Backdrop B', position: [1.7,-c.background,.16], size: [.2,.1,.32], color: '#4d564e'}];
  }
  return scene;
}

export function scheduledMotion(lab, tick) {
  if (lab?.id !== 'stop-go' || !lab.scripted) return null;
  if (lab.variant === 'retreat' && tick === 140) return [.42,0,0];
  if (lab.variant === 'incoming') {
    const c = stopCase('incoming'), stop = Math.round((c.x-.3)/c.speed/.02);
    if (tick === stop) return [0,0,0];
    if (tick === Math.max(stop+25,185)) return [.4,0,0];
  }
  return null;
}

export function labInput(lab, duck, time, input) {
  if (lab?.id !== 'stop-go' || duck.id !== 'duck-1' || duck.mode !== 'brain') return input;
  const c = stopCase(lab.variant);
  return {...input, forward: .12, head: [.04*Math.sin(time*1.8+c.phase),0,c.head*Math.sin(time*2.2+c.phase),0],
    reason: 'Experimental tonic walking drive', headReason: 'Matched study head motion'};
}
