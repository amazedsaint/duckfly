import './action-inspector.css';
import { TRIGGERS, ACTIONS } from './trigger-actions.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = (value, digits=2) => Number.isFinite(value) ? value.toFixed(digits) : 'unavailable';

export function actionInspectorMarkup() {
  return `<dialog id="event-dialog" aria-labelledby="event-title"><div class="dialog-top"><strong id="event-title">Why this action?</strong><button data-close="event-dialog" aria-label="Close action inspector">✕</button></div>
    <p class="hint">Inspect the inputs behind a recorded action. The live scene continues while you browse.</p>
    <div class="action-selection"><label>Duck in recording<select id="event-duck"></select></label><label>Recorded action<select id="event-choice"></select></label></div>
    <p id="event-time"></p><div id="event-content"></div>
    <label class="action-scrub">Recorded event <input id="event-index" type="range" min="0" max="0" value="0" aria-label="Recorded event"></label>
    <section class="action-image"><div class="eye-heading"><strong>Image used for this action</strong><select id="event-eye" aria-label="Recorded camera view"><option value="center">Head</option><option value="left">Left</option><option value="right">Right</option></select></div><canvas id="event-image" width="96" height="64" aria-label="Exact recorded camera frame" hidden></canvas><p id="event-image-status" role="status"></p></section>
    <details class="action-details"><summary>Signals & sources</summary><div id="event-signals"></div></details>
  </dialog>`;
}

export function mountActionInspector({getEvents,getScene,getDuck,requestEvidence,isGuest}) {
  const $=selector=>document.querySelector(selector),dialog=$('#event-dialog');
  let snapshot=[],index=0,requestId=0,evidence=null;
  const current=()=>snapshot[index];
  const currentCause=()=>current()?.causes.find(c=>c.id===$('#event-duck').value);
  const label=c=>c?.provenance?.forward??c?.input?.reason??'Recorded command';
  function renderImage() {
    const canvas=$('#event-image'),select=$('#event-eye');
    const frame=evidence?.frame;
    canvas.hidden=!frame;select.disabled=!frame?.views;
    if(!frame){$('#event-image-status').textContent=evidence?.reason??'Loading the recorded camera frame…';return;}
    if(!frame.views)select.value='center';
    const pixels=select.value==='center'?frame.pixels:frame.views[select.value];
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),96,64),0,0);
    const capture=currentCause()?.vision?.capture;
    $('#event-image-status').textContent=`${frame.sourceId} · frame ${frame.frameId} · ${number(frame.captureTime,3)} s (${frame.clock})${capture?.accepted===false?' · repeated frame; not a new observation':''}${Number.isFinite(capture?.age)?` · age at decision ${number(capture.age,3)} s`:''}`;
  }
  function show(nextIndex) {
    index=Math.max(0,Math.min(snapshot.length-1,Number(nextIndex)||0));
    $('#event-index').value=String(index);$('#event-choice').value=String(index);
    const event=current(),cause=currentCause();evidence=null;requestId++;renderImage();
    if(!event||!cause){
      $('#event-time').textContent='No recorded actions for this duck yet.';
      $('#event-content').textContent='Run the scene to record its first decision.';$('#event-signals').replaceChildren();
      evidence={reason:'No camera frame was used.'};renderImage();return;
    }
    const {input={},neural={},command={},vision,provenance={}}=cause;
    $('#event-time').textContent=`${number(event.time)} s after step · tick ${event.tick} · branch ${event.branch}`;
    $('#event-content').innerHTML=`<div class="action-decision"><span class="eyebrow">BODY COMMAND</span><h3>${escape(label(cause))}</h3><p>${escape(input.reason??'No input explanation was saved.')}</p><div class="action-command"><span>Forward <b>${number(command.vx)} m/s</b></span><span>Turn <b>${number(command.yaw)} rad/s</b></span></div></div>`;
    const rows=[
      ...(cause.connections?[['Signal connections',cause.connections.gate??cause.connections.signals.map(s=>`${TRIGGERS.find(t=>t.id===s.trigger)?.label??s.trigger} (${number(s.value)}) → ${ACTIONS.find(a=>a.id===s.action)?.label??s.action}: ${s.blocked??s.limited??(s.active?'active':'waiting')}`).join('; ')]]:[]),
      ['Visual model',vision?.model??'No model recorded'],
      ['Visual evidence',`Target ${vision?.target?.visible?'seen':'absent'} · bearing ${number(vision?.target?.bearing)}`],
      ['Sensory current',`Forward ${number(input.forward,3)} · turn ${number(input.turn,3)}`],
      ['Loom input',`${number(input.loomL)} left · ${number(input.loomR)} right`],
      ['Neural firing rates',`DNp09 ${number(neural.forward,1)} Hz · DNa ${number(neural.left,1)} / ${number(neural.right,1)} Hz`],
      ['Circuit request',`${number(neural.vx)} m/s · ${number(neural.yaw)} rad/s`],
      ['Forward source',provenance.forward??'Legacy recording'],
      ['Turn source',provenance.yaw??'Legacy recording'],
      ['Head source',provenance.head??'Legacy recording'],
      ['Body policy',`${command.policy??'walking'}${cause.skill?.message?' · '+cause.skill.message:''}`],
      ['Camera frame status',input.fresh===false?'Stale or absent input':input.fresh===true?'Fresh at this decision':'Not recorded'],
    ];
    $('#event-signals').innerHTML=`<table><tbody>${rows.map(([key,value])=>`<tr><th scope="row">${escape(key)}</th><td>${escape(value)}</td></tr>`).join('')}</tbody></table><p class="hint">Commands show what the body was asked to do. The live monitor reports actual movement. Neural activity and camera-derived signals are labeled separately.</p>`;
    if(isGuest?.()){evidence={reason:'The host retains camera images. This shared view contains decision signals only.'};renderImage();return;}
    requestEvidence({type:'action-evidence',requestId,tick:event.tick,branch:event.branch,duckId:cause.id});
  }
  function choices() {
    $('#event-choice').innerHTML=snapshot.map((event,i)=>{
      const cause=event.causes.find(c=>c.id===$('#event-duck').value);
      return `<option value="${i}">${number(event.time)} s · ${escape(label(cause))}</option>`;
    }).join('');
  }
  function open() {
    // Freeze the list on open so incoming telemetry cannot move its indices.
    snapshot=structuredClone([...getEvents()].sort((a,b)=>a.tick-b.tick));
    const ids=[...new Set(snapshot.flatMap(e=>e.causes.map(c=>c.id)))];
    const scene=getScene();
    $('#event-duck').innerHTML=(ids.length?ids:[getDuck()]).map(id=>`<option value="${escape(id)}">${escape(scene.ducks.find(d=>d.id===id)?.name??id)}</option>`).join('');
    if(ids.includes(getDuck()))$('#event-duck').value=getDuck();
    $('#event-index').max=String(Math.max(0,snapshot.length-1));
    $('#event-index').disabled=$('#event-choice').disabled=!snapshot.length;
    choices();show(snapshot.length-1);dialog.showModal();
  }
  $('#inspect-event').onclick=open;
  $('#event-index').oninput=event=>show(event.target.value);
  $('#event-choice').onchange=event=>show(event.target.value);
  $('#event-duck').onchange=()=>{choices();show(index);};
  $('#event-eye').onchange=renderImage;
  dialog.addEventListener('close',()=>{
    // Native dialog close events are queued. An old event must not invalidate
    // a request made by a scene reset followed by an immediate reopen.
    if(dialog.open)return;
    requestId++;evidence=null;
  });
  return {
    receive(message){if(message.requestId!==requestId||!dialog.open)return;evidence=message.evidence;renderImage();},
    reset(){requestId++;snapshot=[];evidence=null;if(dialog.open)dialog.close();},
  };
}
