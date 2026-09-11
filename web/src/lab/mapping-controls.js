import {connectionsMarkup,editConnection} from './connection-controls.js';
import { FORWARD_OPERATIONS, TURN_OPERATIONS, normalizeBrainMapping, brainMappingEnabled, brainMappingSummary } from './brain-mapping.js';
import { SETUP_MODES } from './scene-setup-draft.js';

// The wizard and this panel edit the same scene values. No second UI-only model.
export function mountMappingControls({patch, editSetup}) {
  const root = document.querySelector('#brain-mapping-panel');
  const choices = values => values.map(({value, label}) => `<option value="${value}">${label}</option>`).join('');
  root.innerHTML = `<summary>Brain → duck <span id="mapping-duck-name" class="summary-note"></span></summary><div class="panel-content mapping-content">
    <p class="hint">Edit connections for the selected duck. Changes take effect immediately.</p>
    <label>Input mode<select id="mapping-controller">${choices(SETUP_MODES.map(([value,label]) => ({value,label})))}</select></label>
    <details id="basic-mapping" open><summary>Default connections</summary><div class="mapping-connections"><label><span>Forward neurons <b aria-hidden="true">→</b></span><select id="mapping-forward">${choices(FORWARD_OPERATIONS)}</select></label><label><span>Turn neurons <b aria-hidden="true">→</b></span><select id="mapping-turn">${choices(TURN_OPERATIONS)}</select></label></div></details>
    <div id="custom-connections"></div>
    <p id="mapping-status" class="mapping-status" role="status"></p>
    <div class="mapping-toggles"><label class="check"><input id="mapping-look" type="checkbox">Track the beacon</label><label class="check"><input id="mapping-feedback" type="checkbox">Body feedback</label><label class="check"><input id="mapping-motor" type="checkbox">Connect brain to body</label></div>
    <p class="hint">The stop reflex takes priority. Microduck’s trained controllers handle body movement.</p><button id="mapping-edit-setup">Edit scene setup</button>
  </div>`;
  let duck;
  const connectionEdit=event=>{const next=editConnection(event,duck?.connections);if(next){
    // Keep a numeric field's blur from replacing the button being clicked.
    if(event.target.type==='number')root.querySelector('#custom-connections').dataset.key=JSON.stringify([duck.id,next]);
    patch({connections:next});
  }};
  root.addEventListener('click',connectionEdit);root.addEventListener('change',connectionEdit);
  const $ = id => root.querySelector(id);
  $('#mapping-forward').onchange = event => patch({mapping:{...normalizeBrainMapping(duck),forward:event.target.value}});
  $('#mapping-turn').onchange = event => patch({mapping:{...normalizeBrainMapping(duck),turn:event.target.value}});
  $('#mapping-controller').onchange = event => patch({mode:event.target.value});
  for (const [id,key] of [['look','activeLook'],['feedback','feedback'],['motor','motorEnabled']]) $('#mapping-'+id).onchange = event => patch({[key]:event.target.checked});
  $('#mapping-edit-setup').onclick = editSetup;
  return value => {
    duck = value;
    if (!duck) return;
    const mapping = normalizeBrainMapping(duck), enabled = brainMappingEnabled(duck);
    const host=$('#custom-connections'),key=JSON.stringify([duck.id,duck.connections]);
    if(host.dataset.key!==key){host.innerHTML=connectionsMarkup(duck.connections);host.dataset.key=key;}
    $('#basic-mapping').open=!duck.connections?.enabled;
    $('#basic-mapping summary').textContent=duck.connections?.enabled?'Default connections · saved':'Default connections';
    $('#mapping-look').closest('label').hidden=!!duck.connections?.enabled;
    $('#mapping-duck-name').textContent = duck.name;
    $('#mapping-controller').value = duck.mode;
    $('#mapping-forward').value = mapping.forward;
    $('#mapping-turn').value = mapping.turn;
    $('#mapping-forward').disabled = $('#mapping-turn').disabled = !enabled||!!duck.connections?.enabled;
    for (const [id,key] of [['look','activeLook'],['feedback','feedback'],['motor','motorEnabled']]) $('#mapping-'+id).checked = duck[key];
    $('#mapping-status').textContent = !duck.motorEnabled ? 'Body disconnected. The brain keeps running.' : brainMappingSummary(duck);
    root.classList.toggle('mapping-bypassed', !enabled || !duck.motorEnabled);
  };
}
