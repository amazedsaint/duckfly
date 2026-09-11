import { SCENARIOS } from './scenarios.js';
const choices = (items) => items.map(([value, title]) => `<option value="${value}">${title}</option>`).join('');
const button = (action, text) => `<button data-lab-action="${action}">${text}</button>`;
export function mountGuidedLab({restart, patch, move, push, save, reset, add, stimulus, configure, selectDuck, skill}) {
  const root = document.querySelector('#guided-lab');
  let scene, state, duck, finishedKey, desiredLab = null, runs = [];
  root.innerHTML = `<details id="experiment-controls" class="workspace-panel" data-panel open><summary>Experiment controls <span class="summary-note">Selected duck</span></summary><div class="panel-content"><div class="lab-question"><strong id="lab-question"></strong><button id="lab-retry">Reset scene</button></div>
    <div id="scene-play-controls" class="lab-controls"></div><div data-lab-panel="stop-go" class="lab-controls"><label>Object path<select id="lab-path">${choices([['incoming','Approach with a pause'],['near-miss','Pass beside the duck'],['receding','Move away'],['retreat','Wait, then move away']])}</select></label><label>Stop response<select id="lab-stop">${choices([['hold','Wait until clear · experimental'],['timer','Stop for 1 second'],['gf-off','Disable stop-reflex neurons']])}</select></label><span id="lab-encounter-note" class="hint">Changing a choice restarts this encounter. The scene keeps running.</span></div>
    <div data-lab-panel="gaze" class="lab-controls">${button('beacon-left','Beacon left')}${button('beacon-right','Beacon right')}${button('hide','Hide beacon')}${button('reveal','Reveal beacon')}${button('look','Head tracking')}</div>
    <div data-lab-panel="switchboard" class="lab-controls">${button('connect','Restore all pathways')}${button('forward','Disable walking pathway')}${button('left','Disable left steering')}${button('right','Disable right steering')}${button('output','Disconnect body')}</div>
    <div data-lab-panel="recovery" class="lab-controls">${button('push','Nudge duck')}${button('feedback','Feedback to fly brain')}</div>
    <div class="lab-controls body-skill-controls">${button('skill-kick','Kick left')}${button('skill-recover','Stand up')}<span id="body-skill-status" role="status">Walking controller</span></div><div data-lab-panel="kick" class="lab-controls">${button('beacon-away','Hide beacon')}${button('beacon-ahead','Move beacon ahead')}${button('place-ball','Place ball by left foot')}${button('visual-kick','Visual kick: on')}</div><div class="loop-controls"><button id="motor-link" aria-pressed="true" data-control disabled>Body commands: on</button><button id="feedback-link" aria-pressed="true" data-control disabled>Feedback: on</button><label>Command strength <select id="motor-gain"><option value="1">100%</option><option value="0.5">50%</option><option value="0.25">25%</option><option value="0">0% · hold</option></select></label><span class="hint">Strength adjusts walking commands. Kick and standing actions use their trained movements. Changes apply on the next step.</span></div><p id="lab-observation"></p><div class="lab-readout"><span id="lab-measures"></span><button id="lab-save" hidden>Save observations</button></div>
    <details class="lab-notes"><summary>How this scene works</summary><p id="lab-explanation"></p><p id="lab-previous" hidden></p></details></div></details>`;
  const $ = (selector) => root.querySelector(selector);
  const restartCurrent = (patch = {}) => {
    finishedKey = null;
    desiredLab = {...(desiredLab ?? scene.lab), ...patch};
    restart(desiredLab.id, {variant: desiredLab.variant, condition: desiredLab.condition});
  };
  $('#lab-retry').onclick = () => {finishedKey=null;reset();};
  $('#lab-path').onchange = e => restartCurrent({variant: e.target.value});
  $('#lab-stop').onchange = e => restartCurrent({condition: e.target.value});
  $('#lab-save').onclick = () => save({format: 'duckfly-playground-trials', version: 1,
    interpretation: 'Interactive demonstrations, not independent validation. Edited runs are not matched trials.', runs});
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-lab-action]')?.dataset.labAction;
    if (!action || !duck) return;
    if (action.startsWith('skill-')) return skill(action.slice(6));
    if (action === 'visual-kick') return patch({kickOnSight:!duck.kickOnSight});
    if (action === 'place-ball') {const b=state?.body.ducks.find(d=>d.id===duck.id);if(b)return move('kick-ball',[b.position[0]+Math.cos(b.heading)*.09-Math.sin(b.heading)*.042,b.position[1]+Math.sin(b.heading)*.09+Math.cos(b.heading)*.042,.035],0);}
    if (action === 'beacon-away') {const b=state?.body.ducks.find(d=>d.id===duck.id);if(b)return move('target-1',[b.position[0]-Math.cos(b.heading)*.7,b.position[1]-Math.sin(b.heading)*.7,.14],0);}
    if (action === 'next-duck') return selectDuck(scene.ducks[(scene.ducks.findIndex(d=>d.id===duck.id)+1)%scene.ducks.length].id);
    if (action === 'add-duck' || action === 'add-target') return add(action.slice(4));
    if (action.startsWith('pulse-')) return stimulus(action.slice(6));
    if (action === 'follow-beacon') return patch({mode:'target'});
    if (action === 'flow') return patch({flowSteer:!duck.flowSteer});
    if (action === 'eye-left') return patch({eye:duck.eye==='left'?'both':'left'});
    if (action.startsWith('threat-')) {
      const velocity = action==='threat-in' ? -.25 : action==='threat-out' ? .25 : 0;
      return configure({...scene,props:scene.props.map(p=>p.id==='threat-1'?{...p,position:[1.3,.03,.2],motion:[velocity,0,0],movable:false,behavior:null}:p)});
    }
    if (action === 'push') return push(duck.id);
    if (action === 'feedback') return patch({feedback: !duck.feedback});
    if (action === 'look') return patch({activeLook: !duck.activeLook});
    if (['connect','forward','left','right','output'].includes(action)) return patch({silence: action === 'connect' ? 'none' : action});
    const beaconDuck = action.startsWith('beacon-') && duck.mode==='flock' ? scene.ducks.find(d=>d.mode==='target') ?? duck : duck;
    const body = state?.body.ducks.find(d => d.id === beaconDuck.id);
    if (!body) return;
    if (action.startsWith('beacon-')) {
      const side = action === 'beacon-left' ? .32 : action === 'beacon-right' ? -.32 : 0, h = body.heading;
      const target = scene.props.find(p=>p.kind==='target'); if(!target)return;
      return move(target.id, [body.position[0]+.65*Math.cos(h)-side*Math.sin(h), body.position[1]+.65*Math.sin(h)+side*Math.cos(h), .13], 0);
    }
    const target = state.body.props.find(p => p.id === 'target-1');
    if (action === 'hide' && target) {
      const dx = target.position[0]-body.position[0], dy = target.position[1]-body.position[1];
      return move('wall-1', [body.position[0]+dx*.5,body.position[1]+dy*.5,.17], Math.atan2(dy,dx));
    }
    if (action === 'reveal') return move('wall-1', [body.position[0]+.5,body.position[1]-1,.17], 0);
  });
  return (nextScene, nextState, id) => {
    scene = nextScene; state = nextState; duck = scene.ducks.find(d => d.id === id);
    const lab = scene.lab; root.hidden = !duck;
    if(!duck)return;
    const skillState=state?.agents[id]?.skill,skillBody=state?.body.ducks.find(d=>d.id===id);
    $('#body-skill-status').textContent=skillState?.message??'Walking controller';
    const skillBlocked=!skillBody||!duck.motorEnabled||duck.motorGain===0||duck.silence==='output'||skillState?.phase!=='walk';
    $('[data-lab-action="skill-kick"]').disabled=skillBlocked||!!skillBody?.fallen;
    $('[data-lab-action="skill-recover"]').disabled=skillBlocked||!skillBody?.fallen;
    $('[data-lab-action="visual-kick"]').textContent=`Visual kick: ${duck.kickOnSight?'on':'off'}`;
    $('[data-lab-action="visual-kick"]').setAttribute('aria-pressed',String(duck.kickOnSight));
    const kind = lab?.id ?? SCENARIOS.find(s=>s.title===scene.name)?.id ?? (scene.name==='Open arena'?'empty':'custom');
    const generic = !lab;
    const target = scene.props.some(p=>p.kind==='target');
    const actions = generic ? [
      ...(target?[['beacon-ahead',kind==='flock'?'Move beacon ahead of leader':'Move beacon ahead'],['beacon-left','Beacon left'],['beacon-right','Beacon right'],...(duck.mode==='brain'?[['follow-beacon','Connect beacon vision']]:[])]:[]),
      ...(['occlusion','lookout'].includes(kind)&&scene.props.some(p=>p.id==='wall-1')?[['hide','Hide beacon'],['reveal','Reveal beacon']]:[]),
      ...(kind==='flock'?[['next-duck','Select next duck'],['add-duck','Add duck · resets scene']]:[]),
      ...(kind==='loom'&&scene.props.some(p=>p.id==='threat-1')?[['threat-in','Restart approaching'],['threat-out','Restart retreating'],['threat-still','Restart stationary']]:[]),
      ...(['crossed-wires','trigger-kick'].includes(kind)?[['pulse-walk','DNp09 pulse'],['pulse-left','DNa left pulse'],['pulse-right','DNa right pulse'],['pulse-loom','Loom pulse']]:[]),
      ...(kind==='trigger-kick'?[['place-ball','Place ball by foot'],['beacon-away','Hide beacon'],['beacon-ahead','Reveal beacon']]:[]),
      ...(kind==='vision'?[['flow','Motion steering'],['eye-left','Left eye only']]:[]),
      ...(!target?[['pulse-walk','Walk pulse'],['pulse-left','Left pulse'],['pulse-right','Right pulse'],['add-target','Add beacon · resets scene'],['add-duck','Add duck · resets scene']]:[])
    ] : lab.id==='switchboard'||lab.id==='recovery' ? [['beacon-ahead','Move beacon ahead']] : [];
    const actionKey=JSON.stringify(actions);
    if($('#scene-play-controls').dataset.key!==actionKey){$('#scene-play-controls').innerHTML=actions.map(([a,t])=>button(a,t)).join('');$('#scene-play-controls').dataset.key=actionKey;}
    root.querySelectorAll('[data-lab-panel]').forEach(el => el.hidden = el.dataset.labPanel !== kind);
    if (generic) {
      desiredLab=null;
      const agent=state?.agents[id], body=state?.body.ducks.find(d=>d.id===id);
      const threatSpeed=scene.props.find(p=>p.id==='threat-1')?.motion[0]??0;
      for(const [action,value] of [['threat-in',threatSpeed<0],['threat-out',threatSpeed>0],['threat-still',threatSpeed===0]])$(`[data-lab-action="${action}"]`)?.setAttribute('aria-pressed',String(value));
      $('#lab-question').textContent = ({target:'Guide the duck',occlusion:'Block or reveal the beacon',flock:'Compare the ducks',loom:'Test the approach response',vision:'Compare eye input',empty:'Build your scene'})[kind]??'Scene actions';
      $('#lab-observation').textContent = state?.paused ? 'Paused. Edits take effect on the next Run or Step.' :
        kind==='loom' ? `Object ${threatSpeed<0?'approaching':threatSpeed>0?'retreating':'stationary'}${threatSpeed?' at '+Math.abs(threatSpeed).toFixed(2)+' m/s':''}. Open Why? to inspect recorded stop-reflex activity.` :
        kind==='flock' ? `${duck.name}: ${duck.mode==='flock'?'follows cyan companions':'follows the pink beacon'}. Every duck has its own circuit.` :
        agent?.input?.gate ? 'Walking is paused. Move the beacon into view or remove the object blocking it.' :
        'Move a cue or change a connection. The live monitor shows the delivered command and measured response.';
      $('#lab-measures').textContent = body ? `${body.distance.toFixed(2)} m traveled · ${body.speed.toFixed(2)} m/s` : 'Waiting for measurements';
      $('#lab-explanation').textContent = kind==='vision' ? 'The motion adapter converts camera changes into circuit input. Use the vision test bench to compare it with the full Flyvis reference model.' :
        kind==='loom' ? 'A growing red object stimulates the stop pathway. A stop is not guaranteed collision avoidance. Compare approach with retreat from identical resets; GF events and delivered commands are recorded in Why.' :
        'The camera detects colored cues, then the fly circuit requests movement. A cue smaller than five pixels or hidden from view blocks forward following. Move beacon ahead repositions the object; the circuit still receives only camera-derived input. In direct brain mode, spontaneous circuit activity can also initiate movement.';
      for(const [action,value] of [['flow',duck.flowSteer],['eye-left',duck.eye==='left']])$(`[data-lab-action="${action}"]`)?.setAttribute('aria-pressed',String(value));
      $('#lab-save').hidden=true;$('#lab-previous').hidden=true;
      return;
    }
    if (desiredLab && (lab.id !== desiredLab.id || (lab.variant === desiredLab.variant && lab.condition === desiredLab.condition))) desiredLab = null;
    root.querySelectorAll('[data-lab-panel]').forEach(el => el.hidden = el.dataset.labPanel !== lab.id);
    $('#lab-path').value = (desiredLab ?? lab).variant; $('#lab-stop').value = (desiredLab ?? lab).condition;
    $('#lab-encounter-note').textContent=lab.scripted?'Changing a choice restarts this encounter. Added objects stay in the scene.':'Custom object behavior is active. Choosing a path or stop response restores the preset encounter and restarts. Added objects stay.';
    const body = state?.body.ducks.find(d => d.id === id), agent = state?.agents[id], score = state?.scores[id], loop = agent?.temporal;
    const questions = {'stop-go':'Compare stop responses',gaze:'Find a beacon outside the view',switchboard:'Compare neural pathways',recovery:'Test standing recovery',kick:'Trigger a kick from vision'};
    const explanations = {
      kick:'The real camera must detect the pink cue, and forward neurons must exceed 6 Hz for five motor ticks. An engineered selector waits for a steady stance, runs the upstream left-kick policy for 0.5 seconds, then returns to walking. Hide and reveal the cue to rearm. Covering the eyes, cutting forward neurons or disconnecting body commands prevents a new visual kick. Place ball is your explicit scene edit; ball coordinates never trigger the skill.',
      'stop-go':'Research only. A learned image-sequence adapter sends a pulse into the fly visual pathway. Only a measured Giant Fiber (GF) event can latch the hold. It releases after fresh low scores and measured slowing. The score is not a collision probability. Our retained study had 0/64 hazard contacts, but GF events in 12/64 control trials exceeded the 10% limit. These open scenes start from examples in that study and continue until you pause. A five-second observation is retained; it is not new validation. Covering an eye invalidates the decoder and cannot clear an existing hold.',
      gaze:'Head tracking is a modeled head controller. It can change what reaches the camera, but the body still follows the fly circuit. In our held-out pursuit study it reduced final target error by 1.67 cm on average, below our 3 cm adoption gate. A single successful search cannot establish a general improvement.',
      switchboard:'Cut forward or turn neurons to test their causal role. Disconnect body to keep neural activity visible while stopping commands to the walking policy. The camera adapter is engineered; the selected fly circuit has 668 neurons. This is not a whole fly brain or learned biped balance.',
      recovery:'The nudge applies 2.5 N sideways for 0.2 seconds. This toggle removes gait phase and speed feedback to the fly circuit. Microduck’s walking policy still receives its body observations and controls balance. Compare identical resets before judging the feedback effect. If the duck falls, Stand up tries the upstream standing policy for up to eight seconds. Walking resumes only after one second of measured steady posture. This recovery comes from the Microduck policy, not newly learned fly behavior.'
    };
    $('#lab-question').textContent = questions[lab.id]; $('#lab-explanation').textContent = explanations[lab.id];
    const pressed = (action, value, text) => {const el = $(`[data-lab-action="${action}"]`);el.setAttribute('aria-pressed', String(value));if(text)el.textContent=text;};
    pressed('look', duck.activeLook, `Head tracking: ${duck.activeLook?'on':'off'}`);
    pressed('feedback', duck.feedback, `Feedback to fly brain: ${duck.feedback?'on':'off'}`);
    for (const action of ['connect','forward','left','right','output']) pressed(action, duck.silence === (action==='connect'?'none':action));
    let observation = 'Run the scene to see a response.';
    if (body) {
      if (lab.id === 'stop-go') observation = id !== 'duck-1' ? 'The scripted encounter drives Duck 1. This panel follows your selected duck.' : !loop ? 'The image-sequence adapter is off.' :
        loop.held ? loop.fresh ? 'Stop reflex active. Waiting for the approach signal to fall and the body to slow.' : 'Stop reflex active. Waiting for new frames from both eyes before releasing.' :
        !loop.fresh ? 'Eye frames are missing. New visual signals are paused; the preset walking input remains active.' :
        loop.gfEvents ? 'The GF reflex fired. Watch whether movement resumes before the object clears.' : 'Watching the camera sequence. A high score can stimulate GF through the fly circuit.';
      if (lab.id === 'gaze') observation = agent?.vision?.target.visible ? 'Beacon visible. Its position in the camera image changes the steering signal.' : 'Beacon out of view. Walking pauses while head tracking searches for it.';
      if (lab.id === 'switchboard') observation = duck.silence === 'output' ? 'Body disconnected. Neural activity continues without movement commands.' : duck.silence === 'none' ? 'All pathways connected. Move the beacon or send a pulse.' : `Selected neurons are silenced (${duck.silence}). Compare firing with the resulting body command.`;
      if (lab.id === 'kick') observation = agent?.skill?.message??'Waiting for the visual response';
      if (lab.id === 'recovery') observation = body.fallen ? 'Duck fell. Try Stand up, or restart for an identical nudge.' : `The walking policy is balancing. ${duck.feedback?'Speed and gait phase return to the fly circuit.':'Feedback to the fly circuit is disconnected.'}`;
    }
    $('#lab-observation').textContent = observation;
    $('#lab-measures').textContent = !body ? 'Waiting for measurements' : lab.id === 'stop-go' ?
      `Score ${loop?.risk==null?'unavailable':loop.risk.toFixed(3)} / trigger ${loop?.threshold??'.98'} · GF ${loop?.gfEvents??0} · releases ${loop?.releases??0} · ${state.body.collisionCount} contacts · ${(body.position[0]*100).toFixed(1)} cm forward` :
      lab.id === 'recovery' ? `${body.speed.toFixed(2)} m/s · tilt ${body.tilt.toFixed(1)}° · peak ${score?.maxTilt?.toFixed(1)??'0'}° · feet ${body.contacts.map((c,i)=>(i?'R':'L')+(c?' on':' off')).join(' / ')}` :
      `Beacon visible ${score?.ticks?Math.round(score.visibleTicks/score.ticks*100):0}% of run · forward ${body.command[0].toFixed(2)} m/s · turn ${body.command[1].toFixed(2)} rad/s`;
    if (lab.id === 'stop-go' && state?.tick >= 250 && finishedKey !== state) {
      // One result per reset. Preserve configuration so edited demonstrations are identifiable.
      if (!finishedKey) {runs.push({scene: structuredClone(scene), time: state.body.time, selected: id,
        loop, scores: state.scores, contacts: state.body.collisionCount, position: body.position, fallen: body.fallen});if(runs.length>20)runs.shift();}
      finishedKey = state;
    }
    if (state?.body.time === 0) finishedKey = null;
    $('#lab-save').hidden = lab.id !== 'stop-go' || !runs.length;
    $('#lab-previous').hidden = lab.id !== 'stop-go' || !runs.length;
    $('#lab-previous').textContent = runs.slice(-4).map(r=>`${r.scene.lab.variant} / ${r.scene.lab.condition}: ${r.contacts} contacts, ${r.loop?.gfEvents??0} GF events${r.fallen?', fell':''}`).join(' · ');
  };
}
