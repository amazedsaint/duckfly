import { FIELD_LABELS, normalizeSenses, SENSOR_TRIGGERS } from './senses.js';
import './sensory-controls.css';

export function mountSensoryControls({apply,patchDuck}) {
  const root=document.querySelector('#sensory-source-panel'),$=selector=>root.querySelector(selector);
  root.innerHTML=`<summary>Sensory source <span id="field-name" class="summary-note"></span></summary><div class="panel-content">
    <p id="field-description" class="hint"></p><button id="field-toggle" type="button" aria-pressed="true">Source on</button>
    <div class="field-values"><label>Strength<input id="field-strength" type="number" required min="0" max="5" step=".1"></label><label>Reach · m<input id="field-radius" type="number" required min=".05" max="5" step=".05"></label></div>
    <div class="field-values"><label>X position · m<input id="field-x" type="number" required min="-10" max="10" step=".05"></label><label>Y position · m<input id="field-y" type="number" required min="-10" max="10" step=".05"></label></div>
    <p class="hint">Drag the source on the stage, or change its position here. Changes apply without restarting.</p></div>`;
  let field,duck,key;
  const strengths=new Map();
  $('#field-toggle').onclick=()=>{if(field)apply(field.id,{strength:field.strength>0?0:strengths.get(field.id)??1});};
  for(const id of ['strength','radius','x','y'])$('#field-'+id).onchange=event=>{
    if(!field||!event.target.reportValidity())return;
    const patch=['x','y'].includes(id)?{position:[$('#field-x').valueAsNumber,$('#field-y').valueAsNumber]}:{[id]:event.target.valueAsNumber};
    apply(field.id,patch);
  };
  const monitor=document.querySelector('#sensory-monitor');
  monitor.innerHTML=`<div class="sense-heading"><strong>Senses</strong><span id="sense-status">Waiting for input</span></div>
    <div class="sense-values"><label>Scent · left <meter id="scent-left-meter" min="0" max="1" value="0"></meter><b id="scent-left-value">0%</b></label><label>Scent · right <meter id="scent-right-meter" min="0" max="1" value="0"></meter><b id="scent-right-value">0%</b></label><span>Air current <b id="air-value">0%</b></span><span>Touch <b id="touch-value">Clear</b></span></div>
    <details class="monitor-controls"><summary>Sensor settings</summary><label>Scent sensors<select id="scent-antennae"><option value="both">Both antennae</option><option value="left">Left only</option><option value="right">Right only</option><option value="none">Off</option></select></label><label class="check"><input id="sense-air" type="checkbox">Sense air currents</label><label class="check"><input id="sense-touch" type="checkbox">Sense object contact</label><p class="hint">Scent uses a simulated concentration field. Air feeds the existing fly sensory pathway. Touch comes from the robot’s physical contacts.</p></details>`;
  document.querySelector('#scent-antennae').onchange=e=>{if(duck)patchDuck({senses:{...normalizeSenses(duck.senses),antennae:e.target.value}});};
  for(const sensor of ['air','touch'])document.querySelector('#sense-'+sensor).onchange=e=>{if(duck)patchDuck({senses:{...normalizeSenses(duck.senses),[sensor]:e.target.checked}});};
  return (scene,state,selected,connectedDuck)=>{
    duck=scene.ducks.find(d=>d.id===connectedDuck);
    const config=normalizeSenses(duck?.senses);
    document.querySelector('#scent-antennae').value=config.antennae;
    for(const sensor of ['air','touch'])document.querySelector('#sense-'+sensor).checked=config[sensor];
    field=scene.fields.find(f=>f.id===selected);root.hidden=!field;
    if(!field){key=null;return;}
    if(field.strength>0)strengths.set(field.id,field.strength);
    $('#field-name').textContent=FIELD_LABELS[field.kind];
    $('#field-description').textContent={odor:'A scent spreads around this source. Follow a scent feeds the measured gradient into the fly’s movement pathways. You can also map scent signals directly in Brain → duck.',air:'Air strength feeds DesktopFly’s existing sensory-current input. A strong response can activate the giant-fiber stop. This models a local air stimulus, not a fluid simulation.',light:'This light changes the camera image. Brightness-seeking ducks respond through their vision adapter.'}[field.kind];
    $('#field-toggle').textContent=field.strength>0?'Source on · switch off':'Source off · switch on';
    $('#field-toggle').setAttribute('aria-pressed',String(field.strength>0));
    const next=JSON.stringify(field);
    if(key!==next){
      for(const [id,value] of [['strength',field.strength],['radius',field.radius],['x',field.position[0]],['y',field.position[1]]]){
        const input=$('#field-'+id);if(document.activeElement!==input)input.value=value;
      }
      key=next;
    }
  };
}

export function updateSensoryMonitor(scene,state,id) {
  const root=document.querySelector('#sensory-monitor'),duck=scene.ducks.find(d=>d.id===id),senses=state?.agents[id]?.input?.senses;
  root.hidden=!scene.fields.length&&!duck?.senses&&!duck?.connections?.rules.some(r=>SENSOR_TRIGGERS.has(r.trigger));
  if(root.hidden)return;
  const $=id=>root.querySelector('#'+id);
  for(const side of ['left','right']){
    const value=senses?.scent[side]??0;
    $('scent-'+side+'-meter').value=value;$('scent-'+side+'-value').textContent=Math.round(value*100)+'%';
  }
  $('air-value').textContent=senses?.air.available===false?'Off':Math.round((senses?.air.strength??0)*100)+'%';
  $('touch-value').textContent=senses?.touch.available===false?'Off':senses?.touch.active?'Contact':'Clear';
  $('sense-status').textContent=!senses?'Waiting for input':senses.scent.available===false?'Scent sensors off':senses.scent.detected?'Scent detected':'No scent detected';
}
