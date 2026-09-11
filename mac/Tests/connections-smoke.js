const get=selector=>document.querySelector(selector),telemetry=()=>window.duckflyTelemetry;
const check=(value,message)=>{if(!value)throw Error(message);};
const wait=async predicate=>{const start=Date.now();while(!predicate()){if(Date.now()-start>60000)throw Error('Connection acceptance timed out: '+get('#notice')?.textContent);await new Promise(r=>setTimeout(r,25));}};
const receipts=[];
for(const id of ['cue-workshop','lookout','crossed-wires','trigger-kick']){
  reportAcceptanceStage('connections '+id);await launchScenario(id);
  if(id==='trigger-kick')await wait(()=>telemetry().event?.causes[0]?.command.policy==='kick');
  else await wait(()=>telemetry().time>2);
  get('#pause').click();await wait(()=>telemetry().paused);
  let state=telemetry();
  check(state.scene.version===7&&state.event.causes.every(c=>c.connections?.signals.length),'Native connections missing');
  check(state.ducks.every(d=>!d.fallen),'Duck fell during native scene launch');
  if(id==='cue-workshop'){
    check(state.ducks[0].distance>.1,'Native follower did not travel');
    get('#panel-connections').click();
    const control=get('#brain-mapping-panel [data-rule="connection-1"] [data-connection="action"]');
    control.value='stop';control.dispatchEvent(new Event('change',{bubbles:true}));
    await wait(()=>telemetry().scene.ducks[0].connections.rules[0].action==='stop');
    const time=telemetry().time;get('#pause').click();await wait(()=>telemetry().time>time+.3);get('#pause').click();await wait(()=>telemetry().paused);
    state=telemetry();check(state.ducks[0].command.every(v=>v===0),'Native live remap did not pause movement');
    get('#inspect-event').click();await wait(()=>get('#event-signals').textContent.includes('Signal connections'));
    get('#event-dialog').close();
  }
  if(id==='lookout')check(state.ducks[0].command.every(v=>v===0),'Native head-only mapping moved body');
  if(id==='crossed-wires')check(state.scene.ducks[0].connections.rules[0].action!==state.scene.ducks[1].connections.rules[0].action,'Native duck mappings merged');
  receipts.push({id,time:state.time,ducks:state.ducks.map(d=>({id:d.id,distance:d.distance,command:d.command,fallen:d.fallen})),connections:state.event.causes.map(c=>c.connections)});
}
reportAcceptanceStage('connections add to existing behavior');
await launchScenario('target');await wait(()=>telemetry().time>2);
get('#pause').click();await wait(()=>telemetry().paused);
get('#panel-connections').click();
const panel=get('#brain-mapping-panel');
check(panel.querySelectorAll('.trigger-connections').length===1&&!panel.querySelector('[data-connection="enabled"]'),'Competing native connection editors');
panel.querySelector('.connection-composer > summary').click();
for(const [key,value]of [['draft-trigger','forward'],['draft-action','look-left']]){
  const control=panel.querySelector('[data-connection="'+key+'"]');control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));
}
panel.querySelector('[data-connection="add"]').click();
await wait(()=>telemetry().scene.ducks[0].connections?.includeBrainMapping);
check(telemetry().scene.version===8&&telemetry().scene.ducks[0].mapping.forward==='walk','Native Add replaced existing walking');
const before=telemetry().ducks[0].distance;
get('#pause').click();await wait(()=>telemetry().ducks[0].distance>before+.05&&telemetry().event.causes[0].connections.signals.some(s=>s.active));
get('#pause').click();await wait(()=>telemetry().paused);
check(!telemetry().ducks[0].fallen,'Native added head response destabilized the duck');
receipts.push({id:'target',check:'add a head response while retaining walking',version:telemetry().scene.version,distance:telemetry().ducks[0].distance,passed:true});
return {format:'duckfly-native-trigger-connections',receipts,passed:true};
