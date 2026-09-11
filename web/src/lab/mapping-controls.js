import {connectionsMarkup,editConnection,connectionEditorKey} from './connection-controls.js';
import {includesBrainMapping} from './trigger-actions.js';
import {brainMappingSummary,brainMappingEnabled,patchBrainMapping} from './brain-mapping.js';
import {SETUP_MODES} from './scene-setup-draft.js';

// Setup and the inspector use the same controls and edit the same scene fields.
export function mountMappingControls({patch,editSetup}) {
  const root=document.querySelector('#brain-mapping-panel');
  root.innerHTML=`<summary>Brain → duck <span id="mapping-duck-name" class="summary-note"></span></summary><div class="panel-content mapping-content">
    <div id="duck-connections"></div>
    <details class="mapping-options"><summary>Input & body options</summary><div class="mapping-options-content">
      <label>What feeds the brain?<select id="mapping-controller">${SETUP_MODES.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>
      <p id="mapping-status" class="mapping-status" role="status"></p>
      <div class="mapping-toggles"><label class="check"><input id="mapping-look" type="checkbox">Track the beacon</label><label class="check"><input id="mapping-feedback" type="checkbox">Body feedback</label><label class="check"><input id="mapping-motor" type="checkbox">Connect brain to body</label></div>
    </div></details><button id="mapping-edit-setup">Edit scene setup</button>
  </div>`;
  let duck;
  const details=new Map(),$=id=>root.querySelector(id),host=$('#duck-connections');
  const connectionEdit=event=>{
    const next=editConnection(event,duck);if(!next)return;
    // Numeric blur must not detach the next button or field being clicked.
    if(event.target.type==='number')host.dataset.key=connectionEditorKey(patchBrainMapping(duck,next));
    patch(next);
  };
  root.addEventListener('click',connectionEdit);root.addEventListener('change',connectionEdit);
  $('#mapping-controller').onchange=event=>patch({mode:event.target.value});
  for(const [id,key]of [['look','activeLook'],['feedback','feedback'],['motor','motorEnabled']])$('#mapping-'+id).onchange=event=>patch({[key]:event.target.checked});
  $('#mapping-edit-setup').onclick=editSetup;
  return value=>{
    if(!value)return;
    if(duck)details.set(duck.id,new Map([...host.querySelectorAll('details[data-setup-panel]')].map(el=>[el.dataset.setupPanel,el.open])));
    const active=document.activeElement,ruleId=active?.closest('[data-rule]')?.dataset.rule,operation=host.contains(active)?active.dataset.connection:null;
    duck=value;
    const key=connectionEditorKey(duck);
    if(host.dataset.key!==key){
      host.innerHTML=connectionsMarkup(duck,{live:true});host.dataset.key=key;
      for(const el of host.querySelectorAll('details[data-setup-panel]'))el.open=details.get(duck.id)?.get(el.dataset.setupPanel)??false;
      if(operation){
        const scope=ruleId?host.querySelector(`[data-rule="${CSS.escape(ruleId)}"]`):host;
        const target=operation==='add'?host.querySelector('.connection-rule[data-rule]:last-child [data-connection="action"]'):scope?.querySelector(`[data-connection="${operation}"]`)??(operation.startsWith('brain-')?host.querySelector(`[data-rule^="${operation}-"] [data-connection="action"]`):null);
        (target??host.querySelector('.connection-composer > summary'))?.focus({preventScroll:true});
      }
    }
    $('#mapping-duck-name').textContent=duck.name;
    $('#mapping-controller').value=duck.mode;
    $('#mapping-look').closest('label').hidden=!includesBrainMapping(duck);
    for(const [id,key]of [['look','activeLook'],['feedback','feedback'],['motor','motorEnabled']])$('#mapping-'+id).checked=duck[key];
    $('#mapping-status').textContent=!duck.motorEnabled?'Body disconnected. The brain keeps running.':brainMappingSummary(duck);
    root.classList.toggle('mapping-bypassed',!brainMappingEnabled(duck)||!duck.motorEnabled);
  };
}
