import '../scene-setup.css';
import { validateScene } from './scene.js';
import { PROP_PROFILES, profileFor } from './prop-behavior.js';
import { normalizeBrainMapping, brainMappingEnabled, brainMappingSummary, FORWARD_OPERATIONS, TURN_OPERATIONS } from './brain-mapping.js';
import { SETUP_MODES, cloneSetupScene, setupEntity, addSetupDuck, addSetupProp, addSetupField, removeSetupEntity, setSetupProfile, setSetupValue, setupWarnings } from './scene-setup-draft.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const round = value => Math.round(value * 1000) / 1000;
const clamp = value => Math.max(-10, Math.min(10, value));
const steps = ['Your ducks', 'Brain → body', 'Objects & physics', 'Ready to explore'];
const options = (items, value) => items.map(([id, label]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
const number = (path, label, value, {min = -10, max = 10} = {}) => `<label>${label}<input data-setup-path="${path}" type="number" inputmode="decimal" required min="${min}" max="${max}" step="any" value="${value}"></label>`;
const select = (path, label, items, value, id = '') => `<label>${label}<select ${id ? `id="${id}"` : ''} data-setup-path="${path}">${options(items, value)}</select></label>`;
const toggle = (path, title, description, checked, id = '') => `<label class="setup-toggle"><span><strong>${title}</strong><small>${description}</small></span><input type="checkbox" ${id ? `id="${id}"` : ''} data-setup-path="${path}" ${checked ? 'checked' : ''}></label>`;
const duckIcon = '<svg viewBox="0 0 42 34" aria-hidden="true"><path d="M5 21c0-7 6-11 14-9 0-8 4-11 9-9 6 2 6 9 3 13 1 8-5 13-13 13S5 26 5 21Z" fill="currentColor"/><path d="m32 8 8 4-9 3" fill="#eea65c"/><circle cx="28" cy="8" r="1.8" fill="#203526"/></svg>';
const entityName = entity => entity?.name === 'target' ? 'Beacon' : entity?.name || ({odor:'Scent field', light:'Light field'}[entity?.kind] ?? entity?.kind ?? 'Select an object');

/** Isolated scene editing. onApply receives a normalized draft and may return
 * false (or reject) to keep the dialog open without losing any user changes. */
export function mountSceneSetup({onApply, onClose = () => {}, requiresRestart = () => true}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'scene-setup'; dialog.className = 'scene-setup';
  dialog.setAttribute('aria-labelledby', 'setup-title');
  document.body.append(dialog);
  let draft, original, editing = false, selected = null, selectedDuckId = null, step = 0, busy = false, error = '', drag = null, applying = false;

  function duck() { return draft.ducks.find(d => d.id === selectedDuckId) ?? draft.ducks[0]; }
  function selectedEntity() { return setupEntity(draft, selected); }
  function choose(id) {
    if (!setupEntity(draft, id)) return;
    selected = id;
    if (draft.ducks.some(d => d.id === id)) selectedDuckId = id;
    if (step === 0 && !draft.ducks.some(d => d.id === id)) step = 2;
    if (step === 1 && !draft.ducks.some(d => d.id === id)) step = 2;
    if (step === 2 && draft.ducks.some(d => d.id === id)) step = 0;
    render();
  }
  function entityList(entities) {
    return `<div class="setup-entity-list">${entities.map(entity => `<button type="button" class="setup-entity ${selected === entity.id ? 'is-selected' : ''}" data-setup-select="${esc(entity.id)}" aria-pressed="${selected === entity.id}"><span class="setup-entity-icon ${entity.spawn ? 'is-duck' : ''}" ${entity.color ? `style="--object-color:${entity.color}"` : ''}>${entity.spawn ? duckIcon : `<span class="setup-object-glyph ${entity.kind}"></span>`}</span><span><strong>${esc(entityName(entity))}</strong><small>${entity.spawn ? brainMappingSummary(entity) : entity.kind === 'odor' || entity.kind === 'light' ? `${entity.radius} m sensory field` : PROP_PROFILES.find(([id]) => id === profileFor(entity))?.[1] ?? 'Preset motion'}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>`;
  }
  function positionControls(entity) {
    const isDuck = !!entity.spawn, key = isDuck ? 'spawn' : 'position', position = entity[key];
    return `<div class="setup-coordinate-grid">${number(`${key}.0`, 'X position · m', position[0])}${number(`${key}.1`, 'Y position · m', position[1])}${isDuck ? number('spawn.2', 'Facing · radians', position[2]) : position.length > 2 ? number('position.2', 'Height · m', position[2]) : ''}</div>`;
  }
  function renderDucks() {
    const d = duck(); selected = d.id;
    return `<div class="setup-step-heading"><p class="setup-kicker">01 / MAKE IT YOURS</p><h2>Who is exploring?</h2><p>Start with one duck or add companions. Each gets its own fly brain and its own connections.</p></div>${entityList(draft.ducks)}
      <button type="button" class="setup-add-button" data-setup-action="add-duck" ${draft.ducks.length >= 8 ? 'disabled' : ''}>${duckIcon} Add a duck <span>${draft.ducks.length} / 8</span></button>
      <section class="setup-editor"><div class="setup-editor-title"><h3>${esc(d.name)}</h3><button type="button" data-setup-action="remove-entity" ${draft.ducks.length === 1 ? 'disabled' : ''} aria-label="Remove ${esc(d.name)}">Remove</button></div><label>Give this duck a name<input id="setup-entity-name" data-setup-path="name" maxlength="80" value="${esc(d.name)}" required></label>${positionControls(d)}<p class="setup-help">Drag a duck on the map to place it. The arrow shows its starting direction.</p></section>`;
  }
  function renderAdvancedDuck(d) {
    return `<details class="setup-details"><summary>Advanced vision & brain settings</summary><div class="setup-details-content"><p class="setup-help">Preset research settings are preserved. Open these when you want a controlled comparison.</p>
      ${select('source','Camera input',[['eyes','Duck-eye camera'],['webcam','Device webcam']],d.source)}
      ${select('visionModel','Vision adapter',[['marker-v1','Color marker baseline'],['motion-opponency-v1','Motion opponency experiment']],d.visionModel)}
      ${select('eye','Eye covering',[['both','Both eyes open'],['left','Left eye only'],['right','Right eye only'],['none','Both eyes covered']],d.eye)}
      ${select('silence','Neural intervention',[['none','No intervention'],['output','Silence all body output'],['forward','Silence forward neurons'],['left','Silence left turning'],['right','Silence right turning'],['loom','Suppress looming input'],['gf','Silence giant-fiber output'],['motion','Silence motion input'],['lplc2','Silence LPLC2 input']],d.silence)}
      ${select('temporal','Research stop loop',[['off','Off'],['timer','Temporal adapter with timer'],['hold','Wait until clear']],d.temporal)}
      ${toggle('headStabilization','Stabilize head yaw','Experimental correction for body rotation.',d.headStabilization)}
      ${toggle('flowSteer','Use image motion to steer','Optional optical-flow adapter.',d.flowSteer)}
      ${toggle('motorEnabled','Connect the body','Disconnect to watch the brain without issuing body commands.',d.motorEnabled)}
      <div class="setup-two-columns">${number('motorGain','Body command strength',d.motorGain,{min:0,max:1,step:.05})}${number('gfGain','Giant-fiber input gain',d.gfGain,{min:1,max:12,step:.5})}</div>
      <details><summary>Sensory adapter weights</summary><div class="setup-two-columns">${Object.entries(d.adapter).map(([key,value])=>number(`adapter.${key}`, `${key[0].toUpperCase()+key.slice(1)} input`,value,{min:0,max:.3,step:.01})).join('')}</div></details>
      ${d.mode === 'manual' ? `<div class="setup-two-columns">${number('manual.0','Manual forward request',d.manual[0],{min:-.8,max:.8})}${number('manual.1','Manual turn request',d.manual[1],{min:-.8,max:.8})}</div>` : ''}
      </div></details>`;
  }
  function renderBrain() {
    const d = duck(), mapping = normalizeBrainMapping(d), enabled = brainMappingEnabled(d); selected = d.id;
    return `<div class="setup-step-heading"><p class="setup-kicker">02 / CONNECT THE LOOP</p><h2>Make a connection.</h2><p>Map fly activity to this duck’s actions. Its walking policy handles balance.</p></div>
      <div class="setup-two-columns setup-brain-controls"><label>Connections for<select id="setup-duck-select">${options(draft.ducks.map(item=>[item.id,item.name]),d.id)}</select></label>
      ${select('mode','Behavior',SETUP_MODES,d.mode,'setup-mode')}</div>
      <div class="setup-loop" aria-label="${enabled ? 'Eye input feeds fly neurons, then mapped requests feed the duck body' : 'Direct controller bypasses fly brain mapping'}"><span><b aria-hidden="true">◉</b>Eye input</span><span aria-hidden="true">→</span><span class="${enabled?'':'is-bypassed'}"><b aria-hidden="true">⌘</b>Fly circuit</span><span aria-hidden="true">→</span><span><b aria-hidden="true">${duckIcon}</b>Duck body</span></div>
      ${!enabled ? '<p class="setup-notice">This comparison bypasses the fly circuit. The connections below are saved for when you switch back to a neural behavior.</p>' : ''}
      <div class="setup-wiring ${enabled?'':'is-bypassed'}"><label><span class="setup-signal-label"><i></i> Forward neurons <span aria-hidden="true">→</span></span><select id="setup-forward" data-setup-path="mapping.forward">${options(FORWARD_OPERATIONS.map(o=>[o.value,o.label]),mapping.forward)}</select><small>${esc(FORWARD_OPERATIONS.find(o=>o.value===mapping.forward).description)}</small></label><label><span class="setup-signal-label"><i></i> Turning neurons <span aria-hidden="true">→</span></span><select id="setup-turn" data-setup-path="mapping.turn">${options(TURN_OPERATIONS.map(o=>[o.value,o.label]),mapping.turn)}</select><small>${esc(TURN_OPERATIONS.find(o=>o.value===mapping.turn).description)}</small></label><p class="setup-help">Stop signals still apply. A kick also needs a fresh visual cue and a safe body state.</p></div>
      <p class="setup-mode-help">${SETUP_MODES.find(([id])=>id===d.mode)?.[2]}</p>
      ${toggle('activeLook','Look around','Turn the head toward a visible cue; scan when it disappears.',d.activeLook,'setup-active-look')}${toggle('feedback','Send movement back to the brain','Feed measured gait activity into the circuit.',d.feedback,'setup-feedback')}
      ${renderAdvancedDuck(d)}`;
  }
  function renderPropEditor(p) {
    const profile = profileFor(p), path = !!p.behavior;
    return `<section class="setup-editor"><div class="setup-editor-title"><h3>${esc(entityName(p))}</h3><button type="button" data-setup-action="remove-entity" aria-label="Remove ${esc(entityName(p))}">Remove</button></div>
      <label>Object name<input id="setup-entity-name" data-setup-path="name" maxlength="80" value="${esc(p.name)}" required></label>
      <label>How it behaves<select id="setup-prop-profile">${options([...PROP_PROFILES,...(profile === 'existing-motion' ? [['existing-motion','Keep preset motion']] : [])],profile)}</select></label>
      <p class="setup-mode-help">${path ? 'An animated path moves this object. Collisions affect the duck, while the path keeps moving.' : p.movable ? 'The physics engine moves this object when the duck pushes or hits it.' : 'This object stays anchored. The duck can touch it, but cannot push it away.'}</p>
      ${positionControls(p)}
      ${path ? `<div class="setup-two-columns">${number('behavior.speed','Path speed · m/s',p.behavior.speed,{min:.02,max:1})}${number('behavior.range','Path range · m',p.behavior.range,{min:.05,max:2})}</div>${p.behavior.kind==='patrol'?select('behavior.axis','Move along',[['x','X direction'],['y','Y direction']],p.behavior.axis):''}` : ''}
      <details class="setup-details" ${p.movable ? 'open' : ''}><summary>Size & physical properties</summary><div class="setup-details-content">${p.movable ? `<div class="setup-two-columns">${number('mass','Weight · kg',p.mass,{min:.005,max:20,step:.005})}${number('friction','Surface friction',p.friction,{min:.05,max:3,step:.05})}</div><p class="setup-help">Lower friction slides more easily. More weight takes more force to move.</p>` : `<p class="setup-help">Weight has no effect while the object is anchored or animated.</p>${number('friction','Surface friction',p.friction,{min:.05,max:3,step:.05})}`}
      <div class="setup-coordinate-grid">${p.kind==='ball'||p.kind==='target' ? number('size.0','Diameter · m',p.size[0],{min:.01,max:2}) : p.size.map((size,i)=>number(`size.${i}`,['Length · m','Width · m','Height · m'][i],size,{min:.01,max:2})).join('')}</div>
      <div class="setup-two-columns">${number('yaw','Rotation · radians',p.yaw,{min:-Math.PI,max:Math.PI})}<label>Color<input data-setup-path="color" type="color" value="${p.color}"></label></div>
      ${profile==='existing-motion' ? `<p class="setup-help">This legacy scene uses constant velocity. Change the behavior above for a bounded path.</p><div class="setup-coordinate-grid">${p.motion.map((v,i)=>number(`motion.${i}`,`${['X','Y','Z'][i]} speed · m/s`,v,{min:-2,max:2})).join('')}</div>` : ''}</div></details></section>`;
  }
  function renderFieldEditor(f) {
    return `<section class="setup-editor"><div class="setup-editor-title"><h3>${esc(entityName(f))}</h3><button type="button" data-setup-action="remove-entity">Remove</button></div><p class="setup-help">${f.kind==='odor'?'A scent gradient can drive a duck set to “Follow a scent.”':'A simulated light source changes scene illumination. Brightness-seeking ducks respond through their eye images.'}</p>${positionControls(f)}<div class="setup-two-columns">${number('strength','Field strength',f.strength,{min:0,max:5,step:.1})}${number('radius','Reach · m',f.radius,{min:.05,max:5,step:.05})}</div></section>`;
  }
  function renderObjects() {
    if (draft.ducks.some(d=>d.id===selected)) selected = draft.props[0]?.id ?? draft.fields[0]?.id ?? null;
    const entity = selectedEntity();
    return `<div class="setup-step-heading"><p class="setup-kicker">03 / SHAPE THE EXPERIMENT</p><h2>Give them something to explore.</h2><p>Add a cue to follow, an obstacle, or a ball to push. Set the physics before entering the stage.</p></div>
      <div class="setup-add-grid">${[['target','Beacon','A pink visual cue'],['ball','Ball','Roll and kick'],['block','Block','Push or obstruct'],['wall','Wall','Hide a cue']].map(([kind,title,help])=>`<button type="button" data-add-prop="${kind}" ${draft.props.length>=40?'disabled':''}><span class="setup-object-glyph ${kind}"></span><strong>+ ${title}</strong><small>${help}</small></button>`).join('')}</div>
      <div class="setup-count-line"><span>Objects</span><span>${draft.props.length} / 40</span></div>${entityList(draft.props)}
      <details class="setup-details"><summary>Sensory fields <span>${draft.fields.length ? `(${draft.fields.length})` : ''}</span></summary><div class="setup-details-content"><p class="setup-help">Optional inputs for scent or brightness experiments.</p><div class="setup-two-columns"><button type="button" data-add-field="odor" ${draft.fields.length>=16?'disabled':''}>+ Scent field</button><button type="button" data-add-field="light" ${draft.fields.length>=16?'disabled':''}>+ Light field</button></div>${entityList(draft.fields)}</div></details>
      ${entity ? (draft.fields.includes(entity) ? renderFieldEditor(entity) : renderPropEditor(entity)) : '<div class="setup-empty">An empty stage is fine. Add an object above, or continue with your ducks.</div>'}`;
  }
  function renderReview() {
    const warnings = setupWarnings(draft, original), restart=editing&&requiresRestart(draft);
    return `<div class="setup-step-heading"><p class="setup-kicker">04 / YOUR EXPERIMENT</p><h2>${editing?'Ready to apply your changes?':'Ready when you are.'}</h2><p id="setup-apply-impact">${editing?(restart?'These changes rebuild the stage at its starting positions and reset the clock. Your configured connections are preserved.':'These settings apply to the running scene. Positions and the experiment clock are kept.'):'The scene stays open for as long as you like. You can edit this setup again from the stage.'}</p></div>
      <label>Experiment name<input id="setup-scene-name" maxlength="80" value="${esc(draft.name)}" required></label>
      <div id="setup-review"><div class="setup-review-stats"><span><strong>${draft.ducks.length}</strong>${draft.ducks.length===1?'duck':'ducks'}</span><span><strong>${draft.props.length}</strong>${draft.props.length===1?'object':'objects'}</span><span><strong>∞</strong>Open scene</span></div>
      <div class="setup-review-ducks">${draft.ducks.map(d=>`<div><span class="setup-review-duck-icon">${duckIcon}</span><span><strong>${esc(d.name)}</strong><small>${esc(SETUP_MODES.find(([id])=>id===d.mode)?.[1])}</small><p>${esc(brainMappingSummary(d))}</p></span><button type="button" data-review-duck="${esc(d.id)}">Edit</button></div>`).join('')}</div>
      ${draft.props.length?`<div class="setup-review-objects"><h3>Objects & physics</h3>${draft.props.map(p=>`<div><span class="setup-object-glyph ${p.kind}" style="--object-color:${p.color}"></span><span><strong>${esc(entityName(p))}</strong><small>${esc(PROP_PROFILES.find(([id])=>id===profileFor(p))?.[1]??'Preset motion')}${p.movable?` · ${p.mass} kg · friction ${p.friction}`:p.behavior?` · ${p.behavior.speed} m/s · ${p.behavior.range} m range`:''}</small></span><button type="button" data-review-object="${esc(p.id)}">Edit</button></div>`).join('')}</div>`:''}
      ${draft.fields.length?`<div class="setup-review-objects"><h3>Sensory fields</h3>${draft.fields.map(f=>`<div><span class="setup-object-glyph ${f.kind}"></span><span><strong>${esc(entityName(f))}</strong><small>Strength ${f.strength} · reach ${f.radius} m</small></span><button type="button" data-review-object="${esc(f.id)}">Edit</button></div>`).join('')}</div>`:''}
      ${warnings.map(warning=>`<p class="setup-notice">${esc(warning)}</p>`).join('')}
      <details class="setup-details"><summary>Preserved experiment settings</summary><div class="setup-details-content"><p class="setup-help">${draft.lab ? `Preset: ${esc(draft.lab.id)} · ${esc(draft.lab.variant)} · ${esc(draft.lab.condition)}. ${draft.lab.scripted?'Preset encounter scripting is enabled.':'Your object settings control the encounter.'}` : 'This is an open arena with no preset encounter script.'}</p><p class="setup-help">Random seed: ${esc(draft.seed)}. ${draft.fields.length} sensory field${draft.fields.length===1?'':'s'} preserved. Comparison duration: ${draft.challenge.duration} s; it does not limit the open scene.</p></div></details>
      <div class="setup-launch-note"><strong>Explore directly on the stage</strong><p>Select a duck to watch its brain. Drag objects around, open a settings panel when needed, or use Edit setup to change the whole experiment.</p></div></div>`;
  }
  function bounds() {
    const points = [...draft.ducks.map(d=>d.spawn), ...draft.props.map(p=>p.position), ...draft.fields.map(f=>f.position)];
    for(const p of draft.props){
      const radius=['ball','target'].includes(p.kind)?p.size[0]/2:Math.hypot(p.size[0],p.size[1])/2;
      points.push([p.position[0]-radius,p.position[1]-radius],[p.position[0]+radius,p.position[1]+radius]);
      if(p.behavior?.kind==='orbit')points.push([p.position[0]-2*p.behavior.range-radius,p.position[1]-p.behavior.range-radius],[p.position[0],p.position[1]+p.behavior.range+radius]);
      if(p.behavior?.kind==='patrol'){
        const axis=p.behavior.axis==='x'?0:1;
        for(const sign of [-1,1]){const point=[...p.position];point[axis]+=sign*(p.behavior.range+radius);points.push(point);}
      }
    }
    for(const f of draft.fields)points.push([f.position[0]-f.radius,f.position[1]-f.radius],[f.position[0]+f.radius,f.position[1]+f.radius]);
    const minX = Math.min(-.6,...points.map(p=>p[0]))-.25, maxX = Math.max(1.25,...points.map(p=>p[0]))+.25;
    const minY = Math.min(-.65,...points.map(p=>p[1]))-.25, maxY = Math.max(.65,...points.map(p=>p[1]))+.25;
    const scale = Math.max((maxX-minX)/560,(maxY-minY)/390), cx=(maxX+minX)/2, cy=(maxY+minY)/2;
    return {minX:cx-280*scale,maxY:cy+195*scale,scale};
  }
  function renderMap(fixedBounds) {
    const holder = dialog.querySelector('.setup-map-canvas'); if (!holder) return;
    const b = fixedBounds ?? bounds(), xy = p => [(p[0]-b.minX)/b.scale,(b.maxY-p[1])/b.scale], unit = 1/b.scale;
    const grid = [];
    for (let x=Math.ceil(b.minX/.25)*.25;x<b.minX+560*b.scale;x+=.25) grid.push(`<path d="M${xy([x,0])[0]} 0V390"/>`);
    for (let y=Math.ceil((b.maxY-390*b.scale)/.25)*.25;y<b.maxY;y+=.25) grid.push(`<path d="M0 ${xy([0,y])[1]}H560"/>`);
    const fields = draft.fields.map(f=>{const [x,y]=xy(f.position);return `<circle cx="${x}" cy="${y}" r="${f.radius*unit}" fill="${f.kind==='odor'?'#c6a2e8':'#e7d18a'}" fill-opacity=".07" stroke="${f.kind==='odor'?'#a886c6':'#d7c785'}" stroke-opacity=".4" stroke-dasharray="4 5"/>`;}).join('');
    const paths = draft.props.filter(p=>p.behavior).map(p=>{const [x,y]=xy(p.position),r=p.behavior.range*unit;if(p.behavior.kind==='orbit')return `<circle cx="${x-r}" cy="${y}" r="${r}" class="setup-motion-path"/>`;return `<path d="${p.behavior.axis==='x'?`M${x-r} ${y}H${x+r}`:`M${x} ${y-r}V${y+r}`}" class="setup-motion-path"/>`;}).join('');
    const objects = [...draft.props,...draft.fields,...draft.ducks].map(entity=>{
      const isDuck=!!entity.spawn, point=entity.spawn??entity.position, [x,y]=xy(point), active=entity.id===selected;
      let glyph;
      if(isDuck) glyph=`<g transform="rotate(${-point[2]*180/Math.PI})"><ellipse rx="${Math.max(12,.095*unit)}" ry="${Math.max(9,.062*unit)}" fill="${active?'#deecb7':'#c5d9a9'}"/><path d="M${Math.max(13,.105*unit)} -5l11 5-11 5Z" fill="#e7a261"/><circle cx="${Math.max(6,.046*unit)}" cy="-4" r="2" fill="#253c2b"/></g>`;
      else if(entity.kind==='odor'||entity.kind==='light') glyph=`<circle r="11" fill="${entity.kind==='odor'?'#b899d8':'#e7d18a'}"/><text text-anchor="middle" y="4" fill="#213027" font-size="13">${entity.kind==='odor'?'≈':'☀'}</text>`;
      else if(entity.kind==='target'||entity.kind==='ball') glyph=`<circle r="${Math.max(8,entity.size[0]*unit/2)}" fill="${entity.color}"/>${entity.kind==='target'?'<circle r="3" fill="#ffe4ef"/>':''}`;
      else glyph=`<rect x="${-Math.max(7,entity.size[0]*unit/2)}" y="${-Math.max(7,entity.size[1]*unit/2)}" width="${Math.max(14,entity.size[0]*unit)}" height="${Math.max(14,entity.size[1]*unit)}" rx="3" fill="${entity.color}" transform="rotate(${-entity.yaw*180/Math.PI})"/>`;
      return `<g data-map-entity="${esc(entity.id)}" role="button" tabindex="0" aria-label="${esc(entityName(entity))}, X ${round(point[0])}, Y ${round(point[1])} metres. Drag or use arrow keys to move." aria-pressed="${active}" transform="translate(${x} ${y})" class="setup-map-entity ${active?'is-selected':''}"><circle r="${isDuck?Math.max(26,.14*unit):23}" fill="transparent" class="setup-map-hit"/>${active?'<circle r="25" fill="none" stroke="#e7f3c7" stroke-width="2" stroke-dasharray="3 3"/>':''}${glyph}<text y="${isDuck?35:32}" text-anchor="middle" class="setup-map-label">${esc(entityName(entity))}</text></g>`;
    }).join('');
    holder.innerHTML=`<svg id="setup-map" viewBox="0 0 560 390" role="group" aria-label="Top-down starting layout. Select and drag an item to position it." data-min-x="${b.minX}" data-max-y="${b.maxY}" data-scale="${b.scale}"><rect width="560" height="390" fill="#17291f"/><g class="setup-map-grid">${grid.join('')}</g>${fields}${paths}${objects}<g transform="translate(28 359)" class="setup-map-axis"><path d="M0 0h30m-4-4 4 4-4 4M0 0v-30m-4 4 4-4 4 4"/><text x="36" y="4">X</text><text x="-4" y="-38">Y</text></g></svg>`;
    const status=dialog.querySelector('#setup-map-selection');if(status)status.textContent=selectedEntity()?`${entityName(selectedEntity())} selected`:'Select anything on the map';
  }
  function render(moveFocus = false) {
    const active = document.activeElement, focusId=active?.id, focusPath=active?.dataset?.setupPath;
    const focusButton=active?.tagName==='BUTTON'?['setupAction','setupSelect','addProp','addField'].find(key=>active.dataset[key]):null;
    const focusButtonValue=focusButton?active.dataset[focusButton]:null;
    const openDetails=new Set([...dialog.querySelectorAll('details[open]')].map(el=>el.querySelector('summary')?.textContent));
    dialog.setAttribute('aria-busy',String(busy));
    dialog.innerHTML=`<div class="setup-shell"><header class="setup-header"><div><p class="setup-kicker">${editing?'EDIT YOUR EXPERIMENT':'SCENE SETUP'}</p><h1 id="setup-title">${esc(draft.name)}</h1></div><button type="button" class="setup-close" data-setup-action="cancel" aria-label="Close setup and discard changes" ${busy?'disabled':''}>×</button></header>
      <nav class="setup-steps" aria-label="Setup progress">${steps.map((title,index)=>`<button type="button" data-setup-step-link="${index}" aria-current="${index===step?'step':'false'}" ${busy?'disabled':''}><span>${index<step?'✓':index+1}</span><b>${title}</b></button>`).join('')}</nav>
      <div class="setup-body"><form id="setup-controls" class="setup-form" novalidate ${busy?'inert':''}><div class="setup-mobile-navigation"><button type="button" data-setup-action="show-layout" aria-controls="setup-layout">View layout ↓</button></div><div data-setup-step="${step}">${[renderDucks,renderBrain,renderObjects,renderReview][step]()}</div></form><aside id="setup-layout" class="setup-preview"><div class="setup-mobile-navigation"><button type="button" data-setup-action="show-controls" aria-controls="setup-controls">↑ Back to controls</button></div><div class="setup-preview-title" tabindex="-1"><span class="setup-kicker">YOUR STARTING LAYOUT</span><span class="setup-schematic-badge">2D preview</span></div><div class="setup-map-canvas"></div><div class="setup-map-caption"><span id="setup-map-selection"></span><span>Grid: 25 cm</span></div><p class="setup-help">Drag to place. Arrow keys move a focused item by 5 cm. Real vision and physics begin on the stage.</p><div class="setup-preview-connection"><span class="setup-connection-dot"></span><strong>${esc(duck().name)}</strong><span>${esc(brainMappingSummary(duck()))}</span></div></aside></div>
      <footer class="setup-footer"><div id="setup-error" role="alert" ${error?'':'hidden'}>${esc(error)}</div><div class="setup-footer-row"><button type="button" data-setup-action="${step?'back':'cancel'}" ${busy?'disabled':''}>${step?'← Back':'Cancel'}</button><span class="setup-footer-hint">${step===0?'Defaults are ready. Make it yours, or continue.':step===3?'Everything remains editable on the stage.':`Step ${step+1} of 4`}</span><button type="button" class="primary setup-primary" data-setup-action="${step===3?'apply':'next'}" ${busy?'disabled':''}>${busy?'Applying…':step===3?(editing?'Apply changes':'Start experiment'):'Continue →'}</button></div></footer></div>`;
    renderMap();
    for(const details of dialog.querySelectorAll('details'))if(openDetails.has(details.querySelector('summary')?.textContent))details.open=true;
    dialog.querySelector('form').onsubmit=event=>event.preventDefault();
    if(moveFocus) { dialog.querySelector('.setup-step-heading h2').tabIndex=-1; dialog.querySelector('.setup-step-heading h2').focus(); }
    else if(focusId) dialog.querySelector(`#${CSS.escape(focusId)}`)?.focus();
    else if(focusPath) dialog.querySelector(`[data-setup-path="${focusPath}"]`)?.focus();
    else if(focusButton){const attribute=focusButton.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`);dialog.querySelector(`[data-${attribute}="${CSS.escape(focusButtonValue)}"]`)?.focus();}
  }
  function showError(message) { error=message;const el=dialog.querySelector('#setup-error');if(el){el.textContent=message;el.hidden=false;} }
  function commitControl(input) {
    if(!input.checkValidity())return false;
    if(input.id==='setup-scene-name'){draft.name=input.value;return true;}
    const path=input.dataset.setupPath;if(!path)return false;
    const entity=selectedEntity(),value=input.type==='checkbox'?input.checked:input.type==='number'?input.valueAsNumber:input.value;
    if(path.startsWith('mapping.'))entity.mapping=normalizeBrainMapping(entity);
    const current=path.split('.').reduce((value,key)=>value?.[key],entity);
    // Recommitting an untouched position must not take over a preset path.
    if(Object.is(current,value))return true;
    setSetupValue(draft,selected,path,value);
    if(path==='size.0'&&['ball','target'].includes(entity.kind))entity.size=[value,value,value];
    return true;
  }
  function refreshDraftPresentation() {
    dialog.querySelector('#setup-title').textContent=draft.name;
    for(const button of dialog.querySelectorAll('[data-setup-select]')){
      const entity=setupEntity(draft,button.dataset.setupSelect);if(entity)button.querySelector('strong').textContent=entityName(entity);
    }
    const heading=dialog.querySelector('.setup-editor-title h3');if(heading&&selectedEntity())heading.textContent=entityName(selectedEntity());
    const connected=dialog.querySelector('.setup-preview-connection strong');if(connected)connected.textContent=duck().name;
    const impact=dialog.querySelector('#setup-apply-impact');
    if(impact&&editing)impact.textContent=requiresRestart(draft)?'These changes rebuild the stage at its starting positions and reset the clock. Your configured connections are preserved.':'These settings apply to the running scene. Positions and the experiment clock are kept.';
    renderMap();
  }
  function valid() {
    const form=dialog.querySelector('form');
    if(!form.reportValidity())return false;
    try{
      for(const input of form.querySelectorAll('[data-setup-path],#setup-scene-name'))commitControl(input);
      draft=validateScene({...draft,version:6});error='';return true;
    }catch(e){showError(e.message);return false;}
  }
  function changeStep(next) {
    if(!valid())return;
    step=next;
    if(step<2)selected=duck().id;
    render(true);dialog.querySelector('.setup-form').scrollTop=0;
  }
  function close() {
    if(busy)return;
    if(dialog.open)dialog.close();
  }
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{drag=null;onClose({applied:applying});applying=false;});
  dialog.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button||busy)return;
    error='';
    try {
      if(button.dataset.setupSelect){choose(button.dataset.setupSelect);return;}
      if(button.dataset.reviewDuck){selectedDuckId=button.dataset.reviewDuck;changeStep(1);return;}
      if(button.dataset.reviewObject){selected=button.dataset.reviewObject;changeStep(2);return;}
      if(button.dataset.setupStepLink!==undefined){changeStep(Number(button.dataset.setupStepLink));return;}
      if(button.dataset.addProp){selected=addSetupProp(draft,button.dataset.addProp);render();return;}
      if(button.dataset.addField){selected=addSetupField(draft,button.dataset.addField);render();return;}
      switch(button.dataset.setupAction){
        case 'show-layout':dialog.querySelector('.setup-preview').scrollIntoView({block:'start'});dialog.querySelector('.setup-preview-title').focus({preventScroll:true});break;
        case 'show-controls':{dialog.querySelector('.setup-form').scrollIntoView({block:'start'});const title=dialog.querySelector('.setup-step-heading h2');title.tabIndex=-1;title.focus({preventScroll:true});break;}
        case 'cancel':close();break;
        case 'back':changeStep(step-1);break;
        case 'next':changeStep(step+1);break;
        case 'add-duck':selectedDuckId=selected=addSetupDuck(draft);render();break;
        case 'remove-entity':removeSetupEntity(draft,selected);selected=null;selectedDuckId=draft.ducks.some(d=>d.id===selectedDuckId)?selectedDuckId:draft.ducks[0].id;render();break;
        case 'apply':
          if(!valid())return;
          busy=true;render();
          try{const result=await onApply(structuredClone(draft),{editing,selectedDuckId:duck().id});if(result!==false){applying=true;busy=false;close();}else{busy=false;showError('The scene could not be applied. Your changes are still here.');render();}}
          catch(e){busy=false;showError(e.message||'Could not apply this setup.');render();}
          break;
      }
    }catch(e){showError(e.message);}
  });
  dialog.addEventListener('input',event=>{
    if(busy)return;
    const input=event.target;
    if(input.tagName!=='INPUT'||(!input.dataset.setupPath&&input.id!=='setup-scene-name'))return;
    try{if(commitControl(input)){error='';dialog.querySelector('#setup-error').hidden=true;refreshDraftPresentation();}}
    catch(e){showError(e.message);}
  });
  dialog.addEventListener('change',event=>{
    const input=event.target;if(busy)return;
    try {
      if(input.id==='setup-duck-select'){selectedDuckId=selected=input.value;render();return;}
      if(input.id==='setup-prop-profile'){if(input.value!=='existing-motion')setSetupProfile(draft,selected,input.value);render();return;}
      const path=input.dataset.setupPath;if(!path&&input.id!=='setup-scene-name')return;
      if(!input.reportValidity())return;
      commitControl(input);error='';
      // Replacing the form during a textbox blur detaches the button the user
      // is clicking. Keep it intact so one click advances with the latest text.
      if(input.tagName==='SELECT'||input.type==='checkbox')render();else refreshDraftPresentation();
    }catch(e){showError(e.message);}
  });
  dialog.addEventListener('pointerdown',event=>{
    const item=event.target.closest('[data-map-entity]');if(!item||busy||event.button!==0)return;
    event.preventDefault();
    const id=item.dataset.mapEntity;choose(id);
    const svg=dialog.querySelector('#setup-map'), b={minX:Number(svg.dataset.minX),maxY:Number(svg.dataset.maxY),scale:Number(svg.dataset.scale)}, entity=setupEntity(draft,id), point=entity.spawn??entity.position;
    drag={id,pointerId:event.pointerId,b,start:[event.clientX,event.clientY],point:[...point],rect:svg.getBoundingClientRect()};dialog.setPointerCapture(event.pointerId);
  });
  dialog.addEventListener('pointermove',event=>{
    if(!drag||drag.pointerId!==event.pointerId)return;
    const entity=setupEntity(draft,drag.id), key=entity.spawn?'spawn':'position';
    const pixelsPerSvgUnit=Math.min(drag.rect.width/560,drag.rect.height/390);
    setSetupValue(draft,drag.id,`${key}.0`,round(clamp(drag.point[0]+(event.clientX-drag.start[0])/pixelsPerSvgUnit*drag.b.scale)));
    setSetupValue(draft,drag.id,`${key}.1`,round(clamp(drag.point[1]-(event.clientY-drag.start[1])/pixelsPerSvgUnit*drag.b.scale)));
    renderMap(drag.b);
    for(let i=0;i<2;i++){const input=dialog.querySelector(`[data-setup-path="${key}.${i}"]`);if(input)input.value=entity[key][i];}
  });
  const endDrag=event=>{if(!drag||drag.pointerId!==event.pointerId)return;const id=drag.id;drag=null;if(dialog.hasPointerCapture(event.pointerId))dialog.releasePointerCapture(event.pointerId);render();dialog.querySelector(`[data-map-entity="${CSS.escape(id)}"]`)?.focus();};
  dialog.addEventListener('pointerup',endDrag);dialog.addEventListener('pointercancel',endDrag);
  dialog.addEventListener('keydown',event=>{
    const item=event.target.closest('[data-map-entity]');if(!item||busy)return;
    if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(item.dataset.mapEntity);return;}
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();const id=item.dataset.mapEntity,entity=setupEntity(draft,id),key=entity.spawn?'spawn':'position',axis=['ArrowLeft','ArrowRight'].includes(event.key)?0:1,sign=['ArrowRight','ArrowUp'].includes(event.key)?1:-1;
    setSetupValue(draft,id,`${key}.${axis}`,round(clamp(entity[key][axis]+sign*(event.shiftKey?.2:.05))));
    choose(id);dialog.querySelector(`[data-map-entity="${CSS.escape(id)}"]`)?.focus();
  });
  return {
    open(scene, settings={}) {
      if(busy)return;
      original=cloneSetupScene(scene);draft=cloneSetupScene(scene);editing=!!settings.editing;selectedDuckId=draft.ducks.find(d=>d.id===settings.selectedDuckId)?.id??draft.ducks[0].id;selected=selectedDuckId;step=0;error='';applying=false;
      render();if(!dialog.open)dialog.showModal();dialog.querySelector('[data-setup-action="next"]').focus();
    }, close, isOpen:()=>dialog.open,
  };
}
