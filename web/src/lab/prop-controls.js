import {PROP_PROFILES,profileFor,propProfile} from './prop-behavior.js';

export function mountPropControls({apply}) {
  const root=document.querySelector('#prop-behavior-panel');let prop,key;
  root.innerHTML=`<summary>Behavior & physics <span id="behavior-name" class="summary-note"></span></summary><div class="panel-content">
    <label>Object behavior<select id="prop-profile">${PROP_PROFILES.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>
    <div id="motion-options"><label>Speed <select id="prop-speed"><option value="0.08">Gentle · 8 cm/s</option><option value="0.2">Medium · 20 cm/s</option><option value="0.4">Fast · 40 cm/s</option></select></label><label>Travel radius <select id="prop-range"><option value="0.2">Small · 20 cm</option><option value="0.4">Medium · 40 cm</option><option value="0.8">Wide · 80 cm</option></select></label><label id="prop-axis-label">Direction<select id="prop-axis"><option value="y">Across the scene</option><option value="x">Along the scene</option></select></label></div>
    <p id="prop-profile-note" class="hint"></p><button id="apply-behavior" class="primary">Apply behavior</button><span id="prop-live-state" class="hint"></span></div>`;
  const $=s=>root.querySelector(s);
  const settings=()=>propProfile($('#prop-profile').value,{speed:+$('#prop-speed').value,range:+$('#prop-range').value,axis:$('#prop-axis').value});
  const explain=()=>{
    if(!prop)return;
    const existing=$('#prop-profile').value==='existing-motion';$('#apply-behavior').disabled=existing;
    if(existing){$('#motion-options').hidden=true;$('#apply-behavior').textContent='Choose a new behavior';$('#prop-profile-note').textContent='This object already has straight motion. Choose a preset to replace it, or drag it to stop.';return;}
    const patch=settings(),moving=!!patch.behavior;
    $('#motion-options').hidden=!moving;$('#prop-axis-label').hidden=patch.behavior?.kind!=='patrol';
    const restart=patch.movable!==prop.movable||patch.movable&&(patch.mass!==prop.mass||patch.friction!==prop.friction);
    $('#apply-behavior').textContent=restart?'Apply physics & restart':'Apply in this scene';
    $('#prop-profile-note').textContent=moving?'A scripted path moves this object. The dotted guide is visible to you; the duck sees only the object. Dragging it stops the path.':patch.movable?
      `Gravity and contacts move this body. Weight: ${patch.mass===1?'1 kg':'80 g'}. Surface: ${patch.friction<.1?'slippery':'normal grip'}. Changing physics restarts the scene.`:
      'The object stays where you put it and still collides with the duck.';
  };
  for(const id of ['prop-profile','prop-speed','prop-range','prop-axis'])$('#'+id).onchange=explain;
  $('#apply-behavior').onclick=()=>{if(prop)apply(prop.id,settings());};
  return (scene,state,selected)=>{
    prop=scene.props.find(p=>p.id===selected);root.hidden=!prop;
    if(!prop){key=null;return;}
    $('#behavior-name').textContent=prop.name==='target'?'Beacon':prop.name;
    const nextKey=JSON.stringify([prop.id,prop.movable,prop.mass,prop.friction,prop.behavior,prop.motion]);
    if(nextKey!==key){
      key=nextKey;$('#prop-profile').querySelector('[data-existing]')?.remove();
      if(profileFor(prop)==='existing-motion'){const option=document.createElement('option');option.value='existing-motion';option.textContent='Existing straight motion';option.disabled=true;option.dataset.existing='true';$('#prop-profile').append(option);}
      $('#prop-profile').value=profileFor(prop);
      for(const [id,value] of [['prop-speed',prop.behavior?.speed??.2],['prop-range',prop.behavior?.range??.4]]){
        const select=$('#'+id);select.querySelector('[data-custom]')?.remove();
        if(![...select.options].some(o=>o.value===String(value))){const o=document.createElement('option');o.value=value;o.textContent=`Custom · ${value} m${id==='prop-speed'?'/s':''}`;o.dataset.custom='true';select.append(o);}
        select.value=String(value);
      }
      $('#prop-axis').value=prop.behavior?.axis??'y';explain();
    }
    $('#prop-live-state').textContent=state?.paused?'Paused · Run or Step to see the effect.':prop.motion.some(Boolean)&&!prop.behavior?'This object has an existing straight motion. Applying a preset replaces it.':'Changes affect the selected object only.';
  };
}
