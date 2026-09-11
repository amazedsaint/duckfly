async page => {
await page.goto(await page.evaluate(()=>location.origin));
await page.setViewportSize({width:1440,height:1000});
await page.waitForFunction(()=>window.duckflyTelemetry?.ready,null,{timeout:60000});
return await page.evaluate(async () => {
// Native acceptance uses the same visible setup path as a person opening a scene.
// This file is prepended by the host to each smoke script.
const reportAcceptanceStage = stage => {
  window.webkit?.messageHandlers?.acceptance?.postMessage({stage, tick:window.duckflyTelemetry?.tick, scene:window.duckflyTelemetry?.scene?.name, time:Date.now()});
};
const setupWait = async (predicate, timeout = 30000) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeout)
      throw Error('Scene setup timed out: ' + document.querySelector('#notice')?.textContent);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
const enterSceneCatalog = async () => {
  const get = selector => document.querySelector(selector);
  await setupWait(() => window.duckflyTelemetry?.ready);
  if (get('#home-page').hidden) {
    const back = get('#back-home');
    if (!back || back.closest('[hidden]')) throw Error('Scene gallery has no visible return control');
    back.click();
    await setupWait(() => !get('#home-page').hidden);
  }
  const launch = get('#launch-page');
  if (launch && !launch.hidden) {
    const enter = get('#launch-enter');
    if (!enter || enter.disabled || enter.closest('[hidden]') || enter.getBoundingClientRect().width <= 0)
      throw Error('Launch page has no visible playground entry');
    enter.click();
  }
  await setupWait(() => !get('#home-page').hidden && (!get('#scene-catalog') || !get('#scene-catalog').hidden) && (!get('#launch-page') || get('#launch-page').hidden));
};
const finishSceneSetup = async () => {
  const get = selector => document.querySelector(selector);
  await setupWait(() => get('#scene-setup')?.open);
  for (let step = 0; step < 3; step++) {
    reportAcceptanceStage('wizard step ' + step);
    const form = get('#scene-setup form');
    if (!form.reportValidity()) {
      const invalid = [...form.querySelectorAll('input,select')]
        .filter(input => !input.validity.valid)
        .map(input => ({field:input.dataset.setupPath || input.id, value:input.value, error:input.validationMessage}));
      throw Error('Default scene form is invalid at step ' + step + ': ' + JSON.stringify(invalid));
    }
    const next = get('[data-setup-action="next"]');
    if (!next || next.hidden || next.disabled)
      throw Error('Scene setup did not expose the next step ' + step);
    next.click();
    await setupWait(() => get(`[data-setup-step="${step + 1}"]`));
  }
  if (!get('#scene-setup form').reportValidity()) throw Error('Default scene review is invalid');
  const apply = get('[data-setup-action="apply"]');
  if (!apply || apply.hidden || apply.disabled)
    throw Error('Scene setup did not expose its reviewed launch');
  apply.click();
  await setupWait(() => !get('#scene-setup').open && !get('#experiment-page').hidden);
  reportAcceptanceStage('wizard launch complete');
};
const launchScenario = async id => {
  await enterSceneCatalog();
  const tile = document.querySelector(`[data-scenario="${id}"]`);
  if (!tile || tile.closest('[hidden]')) throw Error('Missing visible scenario tile ' + id);
  tile.scrollIntoView({block:'nearest'});
  tile.click();
  await finishSceneSetup();
};
const loadPresetScene = async id => {
  await launchScenario(id);
  await setupWait(() => !window.duckflyTelemetry.paused);
  document.querySelector('#pause').click();
  await setupWait(() => window.duckflyTelemetry.paused);
  // Existing controller tests require an exact tick-zero starting state.
  document.querySelector('#reset').click();
  await setupWait(() => window.duckflyTelemetry.tick === 0 && window.duckflyTelemetry.paused);
};

const $=s=>document.querySelector(s), t=()=>window.duckflyTelemetry;
let auditStage='startup';
const mark=stage=>{auditStage=stage;reportAcceptanceStage(stage);};
const wait=async(predicate,timeout=20000)=>{const start=Date.now();while(!predicate()){if(Date.now()-start>timeout)throw Error('Audit timed out: '+JSON.stringify({stage:auditStage,waitingFor:String(predicate),scene:t()?.scene?.name,tick:t()?.tick,time:t()?.time,paused:t()?.paused,connectedDuck:t()?.connectedDuck,selected:t()?.selected,ducks:t()?.scene?.ducks.map(d=>({id:d.id,motorEnabled:d.motorEnabled,feedback:d.feedback})),stepDisabled:$('#step')?.disabled,pauseText:$('#pause')?.textContent,notice:$('#notice')?.textContent}));await new Promise(r=>setTimeout(r,20));}};
const check=(condition,message)=>{if(!condition)throw Error(message+' '+JSON.stringify({tick:t()?.tick,paused:t()?.paused,scene:t()?.scene?.name}));};
const errors=[];
window.addEventListener('error',event=>errors.push(String(event.error?.stack||event.message)));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason?.stack||event.reason)));
await wait(()=>t()?.ready);
await enterSceneCatalog();
const requestedScenarios=window.duckflyTestOptions?.scenario?.split(',').filter(Boolean);
const scenarios=[...document.querySelectorAll('[data-scenario]')].map(e=>({id:e.dataset.scenario,title:e.querySelector('h3').textContent})).filter(s=>!requestedScenarios||requestedScenarios.includes(s.id));
check(!requestedScenarios||requestedScenarios.every(id=>scenarios.some(s=>s.id===id)),'Unknown requested diagnostic scenario');
const result={format:'duckfly-catalog-audit',version:4,scenarios:[],controls:[],interactions:[]};
const settle=()=>new Promise(resolve=>setTimeout(resolve,50));
const inView=selector=>{const r=$(selector).getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;};
const openPanel=async(id,button)=>{if(!$(id).open)$(button).click();await settle();check($(id).open,'Missing open panel '+id);};
const sample=()=>{const s=t();return {time:s.time,tick:s.tick,paused:s.paused,loop:s.loop,collisions:s.collisionCount,ducks:s.ducks.map(d=>{const a=s.agents[d.id],v=a?.vision;return {id:d.id,position:d.position,command:d.command,speed:d.speed,distance:d.distance,fallen:d.fallen,tilt:d.tilt,visible:v?.target.visible,neighborVisible:v?.neighbor.visible,area:v?.target.area,pixels:v?.target.candidatePixels,input:a?.input,neural:a?.neural&&{vx:a.neural.vx,yaw:a.neural.yaw,forward:a.neural.forward,spikes:a.neural.spikeCount},temporal:a?.temporal&&{held:a.temporal.held,fresh:a.temporal.fresh,gfEvents:a.temporal.gfEvents}};})};};
for(const scenario of scenarios){
  mark('catalog '+scenario.id);
  if($('#home-page').hidden)$('#back-home').click();
  const name=scenario.id==='empty'?'Open arena':scenario.title;
  await launchScenario(scenario.id);
  mark(scenario.id+' wait for configured world');
  await wait(()=>t().scene.name===name&&t().time>.05);
  const row={...scenario,samples:[]};
  mark(scenario.id+' observe default run');
  for(let at=.5;at<=5;at+=.5){await wait(()=>t().tick>=Math.round(at/.02));row.samples.push(sample());}
  mark(scenario.id+' pause default run');
  if(!t().paused){$('#pause').click();await wait(()=>t().paused);}
  row.final=sample();
  check(inView('#new-scene')&&inView('#eye')&&inView('#brain-plot'),scenario.id+' lost New scene or a live monitor');
  check(row.final.ducks.every(d=>Number.isFinite(d.speed)&&d.command.every(Number.isFinite)),scenario.id+' nonfinite movement');
  check(row.final.ducks.every(d=>!d.fallen),scenario.id+' fell during the default audit');
  result.scenarios.push(row);
  check(!$('#guided-lab').hidden,scenario.id+' is missing scene controls');
  check($('#loop-intent').textContent.length&&$('#loop-command').textContent.length,scenario.id+' missing loop readout');
  const beyond=scenario.id==='target'?1600:300;
  mark(scenario.id+' resume open-ended run');
  $('#pause').click();await wait(()=>t().tick>=beyond,60000);
  check(!t().paused,scenario.id+' automatically stopped at a time limit');
  mark(scenario.id+' pause open-ended run');
  row.openEnded=sample();$('#pause').click();await wait(()=>t().paused);
  if(scenario.id==='stop-go')check(!$('#lab-save').hidden,'Five-second observation was not retained in the open scene');
  await openPanel('#experiment-controls','#panel-experiment');
  $('#body-details').open=true;
  mark(scenario.id+' disconnect motor and feedback');
  $('#motor-link').click();$('#feedback-link').click();
  await wait(()=>!t().scene.ducks[0].motorEnabled&&!t().scene.ducks[0].feedback);
  const tick=t().tick, spikes=t().agents['duck-1'].neural.spikeCount;
  mark(scenario.id+' step disconnected circuit');
  $('#step').click();await wait(()=>t().tick===tick+5&&t().paused);
  check(t().ducks[0].command.every(v=>v===0),scenario.id+' disconnected motor still commanded movement');
  check(t().agents['duck-1'].neural.spikeCount>spikes,scenario.id+' disconnect stopped brain simulation');
  check(t().agents['duck-1'].neural.feedback.drive===0,scenario.id+' feedback disconnect failed');
  result.controls.push({id:scenario.id,disconnected:sample(),actions:[...$('#guided-lab').querySelectorAll('[data-lab-action]')].filter(e=>!e.closest('[hidden]')).map(e=>e.dataset.labAction)});
  mark(scenario.id+' reconnect motor and feedback');
  $('#motor-link').click();$('#feedback-link').click();
  await wait(()=>t().scene.ducks[0].motorEnabled&&t().scene.ducks[0].feedback);
  mark(scenario.id+' reduce command gain');
  $('#motor-gain').value='0.5';$('#motor-gain').dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>t().scene.ducks[0].motorGain===.5);
  mark(scenario.id+' step reconnected circuit');
  $('#step').click();await wait(()=>t().tick===tick+10&&t().paused);
  check(Math.abs(t().ducks[0].command[0])<=.15+1e-9,scenario.id+' gain was ignored');
  result.controls.at(-1).reconnected=sample();
  // Every catalog entry supports a visible, live interaction after its default
  // behavior has been observed. Moving a fixed prop must reach the physics
  // world without restarting time or switching the connected brain.
  const prop=t().scene.props.find(p=>p.id==='bg-a')??t().scene.props.find(p=>!p.movable);
  mark(scenario.id+' interact with the live scene');
  if(prop){
    const connected=t().connectedDuck,at=t().tick;
    await openPanel('#objects-panel','#panel-objects');
    const chip=$('#scene-objects [data-object="'+prop.id+'"]');
    check(chip,'Missing object chip for '+scenario.id);chip.click();
    await settle();
    check(t().selected===prop.id&&t().connectedDuck===connected&&$('#prop-behavior-panel').open,'Selecting '+prop.id+' did not preserve the watched brain or open its physics');
    const before=t().props.find(p=>p.id===prop.id).position.slice();
    $('[data-prop-step="left"]').click();
    await wait(()=>t().props.find(p=>p.id===prop.id).position[1]>before[1]+.1);
    check(t().tick===at&&t().connectedDuck===connected,'Live prop movement reset '+scenario.id+' or changed its brain');
    const after=t().props.find(p=>p.id===prop.id).position.slice();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    await settle();
    check(!$('#prop-behavior-panel').open&&!$('#objects-panel').open,'Escape did not close object settings in '+scenario.id);
    check(inView('#brain-plot')&&inView('#eye'),'Closing object settings hid a monitor in '+scenario.id);
    result.interactions.push({id:scenario.id,action:'select and move prop',prop:prop.id,before,after,preservedTick:at,connectedDuck:connected});
    if(scenario.id==='kick'){
      await openPanel('#objects-panel','#panel-objects');
      $('#scene-objects [data-object="kick-ball"]').click();
      await settle();
      check($('#prop-profile').value==='existing-physics'&&$('#apply-behavior').disabled,'The custom kick ball was incorrectly offered as an unmodified physics preset');
      check(t().scene.props.find(p=>p.id==='kick-ball').mass===.025&&t().scene.props.find(p=>p.id==='kick-ball').friction===.6,'Selecting the kick ball changed its custom physical values');
      check($('#prop-profile-note').textContent.includes('25 g')&&$('#prop-profile-note').textContent.includes('0.6'),'The custom kick ball panel did not show its real weight and friction');
      result.interactions.at(-1).customPhysics={mass:.025,friction:.6,displayed:$('#prop-profile-note').textContent};
    }
  }else{
    const at=t().tick;
    await openPanel('#experiment-controls','#panel-experiment');
    $('[data-lab-action="pulse-walk"]').click();
    check(t().tick===at&&t().paused,'Queuing a pulse advanced the empty scene');
    $('#step').click();await wait(()=>t().tick===at+5&&t().paused);
    check(t().agents['duck-1'].neural.event.includes('walk stimulus')&&t().agents['duck-1'].neural.forward>6,'The empty-scene pulse did not reach the fly circuit');
    result.interactions.push({id:scenario.id,action:'walk pulse reaches live brain',tick:t().tick,forward:t().agents['duck-1'].neural.forward});
  }
}
if(requestedScenarios){
  check(errors.length===0,'Diagnostic catalog raised uncaught errors: '+errors.join('\n'));
  result.errors=errors;result.scope={diagnosticOnly:true,scenarios:requestedScenarios};
  return result;
}
mark('distant beacon and prop physics regressions');
$('#back-home').click();await launchScenario("target");await wait(()=>t().scene.name==='Follow the beacon'&&t().time>.05);
$('#pause').click();await wait(()=>t().paused);
$('#scene-objects [data-object="target-1"]').click();$('#edit-object').click();
const set=(selector,value)=>{const el=$(selector);el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
// Use the actual editor fields. The regression is a cue moved beyond the original recognizer's range.
const fields=[...$('#object-editor').querySelectorAll('input[type="number"]')];
fields[0].value='1.63';fields[1].value='0';$('#apply-object').click();
await wait(()=>t().time===0&&Math.abs(t().scene.props[0].position[0]-1.63)<.001);
$('#close-tools').click();$('#pause').click();await wait(()=>t().tick>=150);$('#pause').click();await wait(()=>t().paused);
result.farBeacon=sample();
check(t().ducks[0].command[0]===0,'Distant target should be gated in the frozen recognizer');
check($('#vision-status').textContent.includes('too small'),'Tiny cue lacks a useful diagnosis');
$('[data-lab-action="beacon-ahead"]').click();
await wait(()=>Math.abs(t().scene.props[0].position[0]-1.63)>.1);
const before=t().ducks[0].distance;$('#pause').click();await wait(()=>t().tick>=300);$('#pause').click();await wait(()=>t().paused);
result.recoveredBeacon=sample();
check(t().ducks[0].distance-before>.15,'Bring beacon ahead did not restore physical walking');
$('#vision-controls').open=true;$('#cover-eyes').click();await wait(()=>t().scene.ducks[0].eye==='none');
const tick=t().tick;$('#step').click();await wait(()=>t().tick===tick+5);
check(t().ducks[0].command[0]===0,'Covered eyes must block following');
result.covered=sample();
$('[data-stimulus="walk"]').click();await new Promise(r=>setTimeout(r,100));
check(t().paused&&t().tick===tick+5,'Queued pulse advanced a paused clock');
check($('#notice').textContent.includes('queued'),'Queued pulse had no explanation');
// Apply motion without restarting the clock or neural state, then switch to real gravity.
$('#back-home').click();await launchScenario("target");
await wait(()=>t().scene.name==='Follow the beacon'&&t().tick>5&&t().tick<50&&!t().paused);$('#pause').click();await wait(()=>t().paused);
$('#scene-objects [data-object="target-1"]').click();
const choose=(id,value)=>{const el=$(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
const motionTick=t().tick;
choose('#prop-profile','patrol');$('#apply-behavior').click();await wait(()=>t().scene.props[0].behavior?.kind==='patrol');
check(t().tick===motionTick,'Adding a motion path reset the clock');
const startPosition=[...t().props[0].position];$('#pause').click();await wait(()=>t().tick>=motionTick+100);$('#pause').click();await wait(()=>t().paused);
check(Math.abs(t().props[0].position[1]-startPosition[1])>.1,'Patrol did not move the physical prop');
result.patrol={time:t().time,prop:t().props[0],definition:t().scene.props[0]};
choose('#prop-profile','orbit');const orbitTick=t().tick;$('#apply-behavior').click();await wait(()=>t().scene.props[0].behavior?.kind==='orbit');
check(t().tick===orbitTick,'Changing motion restarted the scene');
choose('#prop-profile','pushable');check($('#apply-behavior').textContent.includes('restart'),'Physics restart not explained');
$('#apply-behavior').click();await wait(()=>t().tick===0&&t().scene.props[0].movable);
$('#pause').click();await wait(()=>t().tick>=50);$('#pause').click();await wait(()=>t().paused);
check(t().props[0].position[2]<.08,'A pushable body did not fall under gravity');
result.pushable={prop:t().props[0],definition:t().scene.props[0]};
choose('#prop-profile','heavy');$('#apply-behavior').click();await wait(()=>t().tick===0&&t().scene.props[0].mass===1);
check(t().scene.props[0].behavior===null,'Free body retained an animated path');
result.heavy=t().scene.props[0];
check(errors.length===0,'Catalog raised uncaught errors: '+errors.join('\n'));
result.errors=errors;
return result;

});
}
