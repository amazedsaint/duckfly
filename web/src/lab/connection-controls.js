import {TRIGGERS,ACTIONS,newConnection,normalizeConnections,includesBrainMapping} from './trigger-actions.js';
import {normalizeBrainMapping,brainMappingEnabled} from './brain-mapping.js';
import './connection-controls.css';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(values,selected)=>values.map(value=>`<option value="${value.id}" ${value.id===selected?'selected':''} ${value.disabled?'disabled':''}>${esc(value.label)}</option>`).join('');
const signalOptions=selected=>[...new Set(TRIGGERS.map(t=>t.source))].map(group=>`<optgroup label="${group}">${options(TRIGGERS.filter(t=>t.source===group),selected)}</optgroup>`).join('');
export const connectionEditorKey=duck=>JSON.stringify([duck.id,duck.mode,duck.mapping,duck.kickOnSight,duck.connections]);

function brainRows(duck,prefix){
  if(!includesBrainMapping(duck))return '';
  const mapping=normalizeBrainMapping(duck);
  return [
    {id:'forward',signal:'Walking activity',pathway:'DNp09 · Fly circuit',choices:[{id:'walk',label:'Walk forward'},{id:'kick',label:'Kick when ready'},...ACTIONS.filter(a=>!['walk','kick'].includes(a.id)),{id:'off',label:'No action'}],help:'The fly circuit controls the walking request. A kick needs sustained activity, a visible beacon and a steady stance.'},
    {id:'turn',signal:'Steering activity',pathway:'DNa · Fly circuit',choices:[{id:'follow',label:'Follow the turn'},{id:'reverse',label:'Reverse the turn'},...ACTIONS.filter(a=>a.id!=='steer'),{id:'off',label:'No action'}],help:'Left and right neural activity set the turning direction. Reverse the turn to test the opposite response.'},
  ].filter(row=>mapping[row.id]!=='off'||!duck.connections?.rules.some(rule=>rule.id.startsWith('brain-'+row.id+'-'))).map(row=>`<article class="connection-rule connection-brain-rule" data-brain-route="${row.id}">
    <div class="connection-rule-top"><span class="connection-origin">${row.pathway}</span><span class="connection-live" data-brain-live="${row.id}">${mapping[row.id]==='off'?'Off':'Ready'}</span></div>
    <div class="connection-pair"><div class="connection-signal"><span>When</span><strong>${row.signal}</strong></div><span class="connection-arrow" aria-hidden="true">→</span><label>Duck does<select id="${prefix}-${row.id}" data-connection="brain-${row.id}" aria-label="Response to ${row.signal.toLowerCase()}">${options(row.choices.map(choice=>({...choice,disabled:!(row.id==='forward'?['walk','kick','off']:['follow','reverse','off']).includes(choice.id)&&(duck.connections?.rules.length??0)+(row.id==='turn'?2:1)>12})),mapping[row.id])}</select></label></div>
    <details class="connection-details" data-setup-panel="brain-${row.id}"><summary>How it works</summary><p>${row.help}</p></details>
  </article>`).join('');
}

export function connectionsMarkup(duck,{live=false,prefix='mapping'}={}) {
  const config=normalizeConnections(duck.connections)??{enabled:false,rules:[]},available=brainMappingEnabled(duck);
  return `<section class="trigger-connections" aria-label="Duck connections">
    ${live?`<div class="connection-heading"><strong>Connections</strong><span>${includesBrainMapping(duck)?'Ready for this scene':config.rules.length?'Ready to run':'No connections yet'}</span></div><p class="connection-intro">Change a response below. It takes effect in the scene.</p>`:''}
    ${!available?`<div class="connection-bypass" role="status"><strong>${duck.mode==='manual'?'Manual control is active':'Camera rules control this duck'}</strong><p>Connections are saved. Switch to the fly circuit to use them.</p><button type="button" data-connection="use-brain">Use fly connections</button></div>`:''}
    <fieldset class="connection-fields" ${available?'':'disabled'}><legend class="visually-hidden">Signal and response</legend>
    <div class="connection-rules">${brainRows(duck,prefix)}${config.rules.map((rule,index)=>{
      const trigger=TRIGGERS.find(t=>t.id===rule.trigger),action=ACTIONS.find(a=>a.id===rule.action),enabled=config.enabled&&rule.enabled;
      return `<article class="connection-rule ${enabled?'':'is-off'}" data-rule="${rule.id}">
        <div class="connection-rule-top"><label class="connection-switch"><input type="checkbox" data-connection="rule-enabled" aria-label="Enable connection ${index+1}" ${enabled?'checked':''}><span>${enabled?'On':'Off'}</span></label><span class="connection-live" data-connection-live="${rule.id}">${enabled?(live?'Waiting':'Ready'):'Off'}</span><button class="connection-remove" type="button" data-connection="remove" aria-label="Remove connection ${index+1}">×</button></div>
        <div class="connection-pair"><label>When<select data-connection="trigger" aria-label="Signal ${index+1}">${signalOptions(rule.trigger)}</select></label><span class="connection-arrow" aria-hidden="true">→</span><label>Duck does<select data-connection="action" aria-label="Action ${index+1}">${options(ACTIONS,rule.action)}</select></label></div>
        <p class="connection-source"><span>${trigger.source}</span> ${esc(action.description)}</p>
        <details class="connection-details" data-setup-panel="connection-${rule.id}"><summary>Tune response</summary><p>${esc(trigger.description)}</p><p class="connection-measure" data-connection-measure="${rule.id}">${live?'Signal reading appears here while the scene runs.':'Live readings appear when you start the scene.'}</p><div class="connection-tuning"><label>Start at · ${trigger.unit}<input data-connection="threshold" aria-label="Threshold ${index+1}" type="number" required min="0.001" max="${trigger.max}" step="any" value="${rule.threshold}"></label><label>Strength · 0–1<input data-connection="strength" aria-label="Strength ${index+1}" type="number" required min="0" max="1" step=".05" value="${rule.strength}"></label><label>Continue for · seconds<input data-connection="hold" aria-label="Hold ${index+1}" type="number" required min="0" max="3" step=".1" value="${rule.hold}"></label></div></details>
      </article>`;
    }).join('')}</div>
    ${!includesBrainMapping(duck)&&!config.rules.length?'<p class="connection-empty">This duck will hold still. Add a connection to give it a response.</p>':''}
    <details class="connection-composer" data-setup-panel="add-connection"><summary ${config.rules.length>=12?'aria-disabled="true"':''}>＋ Add a connection</summary><div class="connection-composer-body">
      <p>Pick a signal and a response. Your other connections stay in place.</p>
      <div class="connection-pair"><label>When<select data-connection="draft-trigger" aria-label="New signal"><option value="">Choose a signal…</option>${signalOptions('')}</select></label><span class="connection-arrow" aria-hidden="true">→</span><label>Duck does<select data-connection="draft-action" aria-label="New action"><option value="">Choose a response…</option>${options(ACTIONS,'')}</select></label></div>
      <p class="connection-preview" aria-live="polite">${config.rules.length>=12?'This duck has reached the limit of 12 added connections.':`${TRIGGERS.length} signals · ${ACTIONS.length} actions`}</p><button type="button" data-connection="add" disabled>Add connection</button>
    </div></details></fieldset>
    <details class="connection-help" data-setup-panel="connection-help"><summary>When responses overlap</summary><p>A signal connection takes control of the action it uses while active. Other actions keep their current connections. Opposing turns cancel; a pause stops walking and turning.</p><p>The stop reflex and body limits always apply. A fallen duck can only use Stand up. Signals are labeled by source. Scent and touch do not need a camera image.</p></details>
    ${live?'<p class="connection-runtime" role="status"></p>':''}</section>`;
}

export function editConnection(event,duck) {
  const control=event.target.closest('[data-connection]');
  if(!control||!duck)return null;
  const operation=control.dataset.connection;
  const clicks=['add','remove','use-brain'];
  if(event.type==='click'&&!clicks.includes(operation)||event.type==='change'&&clicks.includes(operation))return null;
  if(operation==='use-brain')return {mode:'target'};
  if(!brainMappingEnabled(duck))return null;
  if(operation.startsWith('draft-')){
    const root=control.closest('.trigger-connections'),trigger=TRIGGERS.find(t=>t.id===root.querySelector('[data-connection="draft-trigger"]').value),action=ACTIONS.find(a=>a.id===root.querySelector('[data-connection="draft-action"]').value);
    root.querySelector('[data-connection="add"]').disabled=!trigger||!action||(duck.connections?.rules.length??0)>=12;
    root.querySelector('.connection-preview').textContent=trigger&&action?`${trigger.label} → ${action.label}. ${action.description}`:'Choose a signal and a response.';
    return null;
  }
  if(control.checkValidity&&!control.checkValidity()){control.reportValidity();return null;}
  const route=operation.startsWith('brain-')?operation.slice(6):null;
  if(route&&({forward:['walk','kick','off'],turn:['follow','reverse','off']}[route]??[]).includes(control.value))return {mapping:{...normalizeBrainMapping(duck),[route]:control.value}};
  const current=normalizeConnections(duck.connections),config=structuredClone(current??{enabled:true,rules:[]});
  if(includesBrainMapping(duck))config.includeBrainMapping=true;
  if(current&&!current.enabled)for(const rule of config.rules)rule.enabled=false;
  config.enabled=true;
  if(route){
    const sources=route==='forward'?['forward']:['left','right'];
    if(!['forward','turn'].includes(route)||!ACTIONS.some(a=>a.id===control.value)||config.rules.length+sources.length>12){control.value=normalizeBrainMapping(duck)[route];return null;}
    for(const trigger of sources){let id=1;while(config.rules.some(r=>r.id===`brain-${route}-${id}`))id++;config.rules.push(newConnection(trigger,control.value,`brain-${route}-${id}`));}
    return {mapping:{...normalizeBrainMapping(duck),[route]:'off'},connections:normalizeConnections(config)};
  }
  if(operation==='add'){
    const root=control.closest('.trigger-connections'),trigger=root.querySelector('[data-connection="draft-trigger"]').value,action=root.querySelector('[data-connection="draft-action"]').value;
    if(config.rules.length>=12||!TRIGGERS.some(t=>t.id===trigger)||!ACTIONS.some(a=>a.id===action))return null;
    let id=1;while(config.rules.some(r=>r.id==='connection-'+id))id++;
    config.rules.push(newConnection(trigger,action,'connection-'+id));
    root.querySelector('.connection-composer').open=false;
  }else{
    const id=control.closest('[data-rule]')?.dataset.rule,rule=config.rules.find(r=>r.id===id);
    if(!rule)return null;
    if(operation==='remove')config.rules=config.rules.filter(r=>r.id!==id);
    else if(operation==='rule-enabled')rule.enabled=control.checked;
    else if(operation==='trigger'){rule.trigger=control.value;rule.threshold=TRIGGERS.find(t=>t.id===rule.trigger).threshold;}
    else if(operation==='action')rule.action=control.value;
    else if(['threshold','strength','hold'].includes(operation))rule[operation]=control.valueAsNumber;
    else return null;
  }
  return {connections:normalizeConnections(config)};
}

const friendlyGate=value=>({'Giant-fiber stop':'Stop reflex active','Camera stale or absent':'Waiting for camera input','Body has fallen':'Duck has fallen','Pink cue is not visible':'Waiting for the beacon'}[value]??value);
export function updateConnectionActivity(root,status,{duck,agent,body,cause,paused=false}={}) {
  if(!root||!duck)return;
  const gate=!brainMappingEnabled(duck)?(duck.mode==='manual'?'Manual control':'Camera rules active'):!duck.motorEnabled||duck.motorGain===0?'Body disconnected':duck.silence==='output'?'Body output off':paused?'Scene paused':friendlyGate(status?.gate);
  const summary=root.querySelector('.connection-runtime');
  if(summary)summary.textContent=gate??(status?.paused?'Pause response active':status?.idle?'Waiting for a signal':'Connections are running');
  for(const row of root.querySelectorAll('[data-connection-live]')){
    const rule=duck.connections?.rules.find(r=>r.id===row.dataset.connectionLive),signal=status?.signals.find(s=>s.id===row.dataset.connectionLive);
    const off=!duck.connections?.enabled||!rule?.enabled,blocked=gate??friendlyGate(signal?.blocked??signal?.limited);
    row.classList.toggle('is-active',!off&&!blocked&&!!signal?.active);
    row.textContent=off?'Off':blocked??(signal?.active?'Active':'Waiting');
    const measure=root.querySelector(`[data-connection-measure="${row.dataset.connectionLive}"]`);
    if(measure&&signal)measure.textContent=`Signal: ${signal.value===null?'unavailable':signal.value.toFixed(2)} · Starts at ${signal.threshold}`;
  }
  const mapping=normalizeBrainMapping(duck);
  for(const row of root.querySelectorAll('[data-brain-live]')){
    const route=row.dataset.brainLive,off=mapping[route]==='off';
    const active=route==='turn'?Math.abs(body?.command?.[1]??0)>0:mapping.forward==='kick'?cause?.command?.policy==='kick':(body?.command?.[0]??0)>0;
    const blocked=gate??(status?.paused?'Pause response active':agent?.neural?.gfHeld?'Stop reflex active':null);
    row.classList.toggle('is-active',!off&&!blocked&&active);
    row.textContent=off?'Off':blocked??(active?'Active':'Waiting');
  }
}
