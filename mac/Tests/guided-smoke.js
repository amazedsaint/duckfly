const $=s=>document.querySelector(s),t=()=>window.duckflyTelemetry;
const wait=async fn=>{const start=Date.now();while(!fn()){if(Date.now()-start>25000)throw Error('Guided check timed out: '+JSON.stringify({time:t()?.time,scene:t()?.scene.name,notice:$('#notice')?.textContent}));await new Promise(r=>setTimeout(r,20));}};
const check=(v,m)=>{if(!v)throw Error(m);};
const select=(id,value)=>{const e=$(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));};
await wait(()=>t()?.ready);
$('[data-scenario="stop-go"]').click();
await wait(()=>t().scene.lab?.id==='stop-go'&&t().time>.1);
const trials=[];
for(const condition of ['hold','timer','gf-off']){
  select('#lab-stop',condition);$('#lab-retry').click();
  await wait(()=>t().scene.lab.condition===condition&&t().tick===250&&t().paused);
  const s=t();trials.push({condition,contacts:s.collisionCount,position:s.ducks[0].position,fallen:s.ducks[0].fallen,loop:s.agents['duck-1'].temporal});
  check(!s.ducks[0].fallen,'Native trial fell');
}
check(trials[0].contacts===0&&trials[0].loop.releases===1,'Native hazard hold failed');
check(trials[1].contacts>0,'Native timer failure did not reproduce');
check(trials[2].loop.gfEvents===0&&!trials[2].loop.held,'Native GF lesion failed');
$('#back-home').click();$('[data-scenario="switchboard"]').click();
await wait(()=>t().scene.lab?.id==='switchboard'&&t().time>.3);
$('[data-lab-action="output"]').click();await wait(()=>t().scene.ducks[0].silence==='output'&&t().ducks[0].command.every(v=>v===0));
check(t().agents['duck-1'].neural.spikeCount>0,'Neural activity stopped with output');
for(const id of ['eye','brain-plot']){const r=$('#'+id).getBoundingClientRect();check(r.height>0&&r.top>=0&&r.bottom<=innerHeight,id+' must remain visible');}
$('#pause').click();await wait(()=>t().paused);
return {pass:true,format:'duckfly-native-guided',trials,checks:['Bundled temporal artifact and stereo loop','GF timer versus hold and GF lesion','Output intervention preserves visible neural activity']};
