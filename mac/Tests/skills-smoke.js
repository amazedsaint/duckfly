const $=s=>document.querySelector(s),t=()=>window.duckflyTelemetry;
const wait=async(p,ms=25000)=>{const start=Date.now();while(!p()){if(Date.now()-start>ms)throw Error('Skill UI timeout: '+$('#notice')?.textContent);await new Promise(r=>setTimeout(r,20));}};
const check=(p,m)=>{if(!p)throw Error(m);};
await wait(()=>t()?.ready);
if($('#home-page').hidden)$('#back-home').click();await launchScenario("kick");
await wait(()=>t().scene.lab?.id==='kick'&&t().tick>0);
const samples=[];
await wait(()=>{const s=t();samples.push({tick:s.tick,position:s.ducks[0].position,fallen:s.ducks[0].fallen,ball:s.props.find(p=>p.id==='kick-ball').position,skill:s.agents['duck-1'].skill,visible:s.agents['duck-1'].vision?.target.visible,forward:s.agents['duck-1'].neural?.forward});return s.tick>=225;});
$('#pause').click();await wait(()=>t().paused);
// A half-second action can fall between UI polling samples under load.
// Inspect the retained delivered-command events, not just the latest phase.
const deliveredPolicies=(minTick=0)=>{$('#inspect-event').click();const out=[];for(let i=0;i<=Number($('#event-index').max);i++){$('#event-index').value=String(i);$('#event-index').dispatchEvent(new Event('input'));const row=[...document.querySelectorAll('#event-signals tr')].find(r=>r.cells[0].textContent==='Body policy');if(row&&Number($('#event-time').textContent.match(/tick (\d+)/)[1])>=minTick)out.push(row.cells[1].textContent);}$('#event-dialog').close();return out;};
const delivered=deliveredPolicies();check(delivered.some(p=>p.startsWith('kick')),'No delivered kick policy: '+JSON.stringify({samples,delivered}));
check(samples.every(s=>!s.fallen),'Visual kick caused a fall');
const ball=samples.at(-1).ball;check(Math.hypot(ball[0]-.09,ball[1]-.042)>.1,'Kick did not move ball');
check(!$('#brain-panel').hidden&&$('#brain-panel canvas'),'Selected brain not visible');
$('[data-lab-action="beacon-away"]').click();$('#step').click();await wait(()=>t().agents['duck-1'].skill.armed);
$('[data-lab-action="place-ball"]').click();$('[data-lab-action="beacon-ahead"]').click();
$('#pause').click();const start=t().tick;let again=false;
await wait(()=>{again||=t().agents['duck-1'].skill.phase==='kick';return t().tick>=start+200;});$('#pause').click();await wait(()=>t().paused);again=deliveredPolicies(start+1).some(p=>p.startsWith('kick'));check(again,'Hide/reveal failed to rearm');
// Covering the eye via the UI cancels the visual experiment before a new trial.
$('#vision-controls').open=true;$('#cover-eyes').click();await wait(()=>t().scene.ducks[0].eye==='none');$('#reset').click();await wait(()=>t().tick===0);
$('#pause').click();let coveredKick=false;await wait(()=>{coveredKick||=t().agents['duck-1'].skill.phase==='kick';return t().tick>=175;});
$('#pause').click();await wait(()=>t().paused);coveredKick=deliveredPolicies().some(p=>p.startsWith('kick'));check(!coveredKick,'Covered eyes triggered a visual kick');
return {format:'duckfly-native-skills-ui',version:1,passed:true,renderedKick:true,rearmed:again,coveredKick,ballDisplacement:Math.hypot(ball[0]-.09,ball[1]-.042),deliveredPolicies:delivered,sampledKickPhase:samples.some(s=>s.skill.phase==='kick'),samples};
