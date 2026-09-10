import { FORWARD_OPERATIONS, TURN_OPERATIONS, normalizeBrainMapping, brainMappingEnabled, brainMappingSummary } from './brain-mapping.js';
import { SETUP_MODES } from './scene-setup-draft.js';

// The wizard and this panel edit the same scene values. No second UI-only model.
export function mountMappingControls({patch, editSetup}) {
  const root = document.querySelector('#brain-mapping-panel');
  const choices = values => values.map(({value, label}) => `<option value="${value}">${label}</option>`).join('');
  root.innerHTML = `<summary>Brain → duck <span id="mapping-duck-name" class="summary-note"></span></summary><div class="panel-content mapping-content">
    <p class="hint">Connections apply to the duck selected in the live brain monitor. Changes take effect in this run.</p>
    <label>What supplies the brain input?<select id="mapping-controller">${choices(SETUP_MODES.map(([value,label]) => ({value,label})))}</select></label>
    <div class="mapping-connections"><label><span>Forward neurons <b aria-hidden="true">→</b></span><select id="mapping-forward">${choices(FORWARD_OPERATIONS)}</select></label><label><span>Turn neurons <b aria-hidden="true">→</b></span><select id="mapping-turn">${choices(TURN_OPERATIONS)}</select></label></div>
    <p id="mapping-status" class="mapping-status" role="status"></p>
    <div class="mapping-toggles"><label class="check"><input id="mapping-look" type="checkbox">Look toward the cue</label><label class="check"><input id="mapping-feedback" type="checkbox">Body motion feeds back</label><label class="check"><input id="mapping-motor" type="checkbox">Connect brain to body</label></div>
    <p class="hint">The stop reflex can still interrupt movement. Walking and kicking use Microduck’s trained body policies.</p><button id="mapping-edit-setup">Edit all scene settings</button>
  </div>`;
  let duck;
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
    $('#mapping-duck-name').textContent = duck.name;
    $('#mapping-controller').value = duck.mode;
    $('#mapping-forward').value = mapping.forward;
    $('#mapping-turn').value = mapping.turn;
    $('#mapping-forward').disabled = $('#mapping-turn').disabled = !enabled;
    for (const [id,key] of [['look','activeLook'],['feedback','feedback'],['motor','motorEnabled']]) $('#mapping-'+id).checked = duck[key];
    $('#mapping-status').textContent = !duck.motorEnabled ? 'Body disconnected. The brain keeps running.' : brainMappingSummary(duck);
    root.classList.toggle('mapping-bypassed', !enabled || !duck.motorEnabled);
  };
}
