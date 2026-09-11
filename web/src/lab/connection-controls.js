import {TRIGGERS,ACTIONS,newConnection,normalizeConnections} from './trigger-actions.js';
import './connection-controls.css';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(values,selected)=>values.map(value=>`<option value="${value.id}" ${value.id===selected?'selected':''}>${esc(value.label)}</option>`).join('');
export function connectionsMarkup(value) {
  const config=normalizeConnections(value)??{enabled:false,rules:[]};
  return `<section class="trigger-connections" aria-label="Signal to action connections"><label class="check connection-enable"><input type="checkbox" data-connection="enabled" ${config.enabled?'checked':''}><strong>Use custom connections</strong></label>
    <p class="hint">${TRIGGERS.length} available signals · ${ACTIONS.length} robot actions. Choose a signal and the action it triggers.</p><p class="hint">Custom connections replace the defaults. The duck holds still when no connection is active.</p>
    <div class="connection-rules">${config.rules.map((rule,index)=>{
      const trigger=TRIGGERS.find(t=>t.id===rule.trigger),action=ACTIONS.find(a=>a.id===rule.action);
      return `<article class="connection-rule" data-rule="${rule.id}"><div class="connection-rule-top"><label class="check"><input type="checkbox" data-connection="rule-enabled" ${rule.enabled?'checked':''}>Connection ${index+1}</label><button type="button" data-connection="remove" aria-label="Remove connection ${index+1}">×</button></div>
        <div class="connection-pair"><label>Signal<select data-connection="trigger" aria-label="Signal ${index+1}">${['Fly circuit','Camera rule','Vision adapter','Body feedback'].map(group=>`<optgroup label="${group}">${options(TRIGGERS.filter(t=>t.source===group),rule.trigger)}</optgroup>`).join('')}</select></label><span aria-hidden="true">→</span><label>Action<select data-connection="action" aria-label="Action ${index+1}">${options(ACTIONS,rule.action)}</select></label></div>
        <p class="connection-source"><span>${trigger.source}</span> ${esc(trigger.description)}<br><strong>${esc(action.label)}:</strong> ${esc(action.description)}</p><p class="connection-live" data-connection-live="${rule.id}">Start the scene to see live activity.</p>
        <details data-setup-panel="connection-${rule.id}"><summary>Response settings</summary><div class="connection-tuning"><label>Activate at · ${trigger.unit}<input data-connection="threshold" aria-label="Threshold ${index+1}" type="number" required min="0.001" max="${trigger.max}" step="any" value="${rule.threshold}"></label><label>Action strength · 0–1<input data-connection="strength" aria-label="Strength ${index+1}" type="number" required min="0" max="1" step=".05" value="${rule.strength}"></label><label>Keep active after signal · s<input data-connection="hold" aria-label="Hold ${index+1}" type="number" required min="0" max="3" step=".1" value="${rule.hold}"></label></div></details></article>`;
    }).join('')}</div><button type="button" data-connection="add" ${config.rules.length>=12?'disabled':''}>＋ Add connection</button>
    <details class="connection-help" data-setup-panel="connection-help"><summary>How connections work</summary><p class="hint">Each signal is labeled with its source. Camera rules are calculated from the image; fly-circuit signals come from simulated neural activity.</p><p class="hint">A signal activates its action at the threshold you set. Opposing turns cancel. A pause overrides walking and turning. The stop reflex and body limits take priority over all connections.</p><p class="hint">Low walking strength may be too weak to start a step. Arcs request 0.3 m/s forward speed; strength adjusts the turn. The robot has no backward-walking controller.</p></details>
    <p class="connection-runtime" role="status"></p></section>`;
}
export function editConnection(event,value) {
  const control=event.target.closest('[data-connection]');
  if(!control)return null;
  const operation=control.dataset.connection;
  if(event.type==='click'&&!['add','remove'].includes(operation)||event.type==='change'&&['add','remove'].includes(operation))return null;
  if(control.checkValidity&&!control.checkValidity()){control.reportValidity();return null;}
  const config=structuredClone(normalizeConnections(value)??{enabled:false,rules:[]});
  if(operation==='enabled'){
    config.enabled=control.checked;
    if(config.enabled&&!config.rules.length)config.rules=[newConnection(),newConnection('forward','steer','connection-2')];
  }else if(operation==='add'){
    let id=1;while(config.rules.some(r=>r.id==='connection-'+id))id++;
    config.rules.push(newConnection('forward','walk','connection-'+id));config.enabled=true;
  }else{
    const id=control.closest('[data-rule]').dataset.rule,rule=config.rules.find(r=>r.id===id);
    if(!rule)return null;
    if(operation==='remove')config.rules=config.rules.filter(r=>r.id!==id);
    else if(operation==='rule-enabled')rule.enabled=control.checked;
    else if(operation==='trigger'){rule.trigger=control.value;rule.threshold=TRIGGERS.find(t=>t.id===rule.trigger).threshold;}
    else if(operation==='action')rule.action=control.value;
    else if(['threshold','strength','hold'].includes(operation))rule[operation]=control.valueAsNumber;
    else return null;
  }
  return normalizeConnections(config);
}
export function updateConnectionActivity(root,status) {
  if(!root)return;
  const summary=root.querySelector('.connection-runtime');
  if(summary)summary.textContent=status?(status.gate??(status.paused?'Pause connection active':status.idle?'Waiting for a signal':'Connections active')):'';
  for(const row of root.querySelectorAll('[data-connection-live]')){
    const signal=status?.signals.find(s=>s.id===row.dataset.connectionLive);
    row.classList.toggle('is-active',!!signal?.active&&!signal?.blocked);
    row.textContent=signal?`Signal ${signal.value===null?'unavailable':signal.value.toFixed(2)} · threshold ${signal.threshold} · ${signal.blocked??signal.limited??(signal.active?'Active':signal.matched?'Threshold reached':'Waiting')}`:'Inactive · custom connections are off or this input mode bypasses them.';
  }
}
