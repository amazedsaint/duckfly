let stage='initialization';
const wait=async(condition,timeout=60000)=>{const start=Date.now();while(!condition()){if(Date.now()-start>timeout)throw Error('Native vision acceptance timed out at '+stage+': '+document.querySelector('#notice')?.textContent+'; time '+window.duckflyTelemetry?.time);await new Promise(r=>setTimeout(r,25));}};
const $=s=>document.querySelector(s),t=()=>window.duckflyTelemetry,check=(v,m)=>{if(!v)throw Error(m);};
const select=(selector,value)=>{const el=$(selector);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
const run=async seconds=>{const start=t().time;$('#pause').click();await wait(()=>t().time>=start+seconds);$('#pause').click();await wait(()=>t().paused);return t();};
const receipts=[];await wait(()=>t()?.ready);await loadPresetScene('vision');
stage='stereo approach';let state=await run(3);check(!state.ducks[0].fallen&&state.ducks[0].position[0]>.15,'Native stereo approach failed');check(state.event.causes[0].provenance.forward,'Action provenance missing');receipts.push({check:'stereo approach',position:state.ducks[0].position});
stage='Flyvis bench';$('#vision-bench').click();select('#bench-model','flyvis-000');$('#bench-run').click();await wait(()=>window.duckflyVisionBench?.model==='flyvis-000');
const reference=window.duckflyVisionBench;check(reference.validation.numericalParity&&!reference.validation.bodyBridge,'Reference gate flags incorrect');check(reference.trace.some(t=>t.populations.T5d>.01),'Native T5 response absent');receipts.push({check:'full Flyvis in WKWebView',timing:reference.loopTimingMs,dt:reference.integrationDt});
stage='signed spatial reference';check(reference.version===2&&Object.keys(reference.spatialMetadata.populations).length===8,'Native spatial metadata missing');
let negative=0,positive=0;for(const frame of reference.trace){check(frame.gfStop===null,'Reference incorrectly claims a measured GF response');for(const [type,population] of Object.entries(frame.spatial.populations)){
  check(population.raw.length===721&&population.delta.length===721,'Native spatial map lost cells');
  for(let i=0;i<721;i++){const delta=population.delta[i];check(delta===Math.fround(population.raw[i]-reference.baseline.populations[type][i]),'Native signed delta differs from baseline');if(delta<0)negative++;if(delta>0)positive++;}
}}
check(negative>0&&positive>0,'Native display discarded a response sign');
$('#spatial-frame').value='8';$('#spatial-frame').dispatchEvent(new Event('input',{bubbles:true}));select('#spatial-population','T5b');$('#spatial-cell').value='210';$('#spatial-cell').dispatchEvent(new Event('input',{bubbles:true}));
check(!$('#spatial-follow').checked&&$('#spatial-time').textContent.includes('0.32 s'),'Native response scrubber failed');
check($('#spatial-values').textContent.includes('change '+reference.trace[8].spatial.populations.T5b.delta[210].toFixed(4)),'Native cell inspector differs from exported trace');
receipts.push({check:'signed maps and recorded cell inspection',negative,positive,frames:reference.trace.length});
stage='flash bench';select('#bench-model','motion-opponency-v1');select('#bench-stimulus','flash');$('#bench-run').click();await wait(()=>window.duckflyVisionBench?.model==='motion-opponency-v1');check(window.duckflyVisionBench.trace.every(t=>t.loomL===0&&t.loomR===0&&!t.gfStop),'Flash recruited native looming');receipts.push({check:'flash falsifier'});
stage='expansion bench';select('#bench-stimulus','expand-off');$('#bench-gain').value='10';$('#bench-run').click();await wait(()=>window.duckflyVisionBench?.stimulus==='expand-off'&&window.duckflyVisionBench.gfGain===10);check(window.duckflyVisionBench.trace.some(t=>t.gfStop),'Explicit gain 10 native bridge absent');receipts.push({check:'OFF expansion at explicit gain 10'});$('#bench-close').click();
stage='recorded action inspection';const beforeInspection=JSON.stringify({time:t().time,branch:t().branch,ducks:t().ducks,agents:t().agents});
$('#inspect-event').click();await wait(()=>!$('#event-image').hidden);
check($('#event-image-status').textContent.includes('eyes:duck-1'),'Native inspector selected the wrong camera');
check($('#event-time').textContent.includes('tick '+t().tick),'Native inspector selected the wrong action');
select('#event-eye','left');const recordedLeft=$('#event-image').getContext('2d').getImageData(0,0,96,64).data;
select('#event-eye','right');const recordedRight=$('#event-image').getContext('2d').getImageData(0,0,96,64).data;
check(recordedLeft.some((value,index)=>value!==recordedRight[index]),'Native inspector mixed the two eyes');
$('#event-index').value='0';$('#event-index').dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>!$('#event-image').hidden);
check(JSON.stringify({time:t().time,branch:t().branch,ducks:t().ducks,agents:t().agents})===beforeInspection,'Native inspection changed the paused experiment');
receipts.push({check:'native recorded action and exact stereo image inspection',status:$('#event-image-status').textContent});$('#event-dialog').close();
if(window.duckflyTestOptions?.visionBenchOnly)return {format:'duckfly-native-vision-bench-acceptance',scope:'Stereo approach, stimulus bench and recorded action inspector only; webcam acceptance not run',receipts};
let timer,stream,testVideo;const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){testVideo=this;return originalPlay.call(this);};Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const c=document.createElement('canvas');c.width=96;c.height=64;const ctx=c.getContext('2d');const draw=()=>{ctx.fillStyle='#777';ctx.fillRect(0,0,96,64);ctx.fillStyle='#f02882';ctx.fillRect(32,22,16,18);};draw();stream=c.captureStream(25);timer=setInterval(draw,40);return stream;}});
stage='camera enable';$('#webcam').click();await wait(()=>$('#webcam').textContent==='Stop webcam');select('#source','webcam');stage='fresh decoded camera';state=await run(.6);check(state.agents['duck-1'].vision?.target.visible&&state.agents['duck-1'].input.fresh&&state.agents['duck-1'].input.forward>0,'Native decoded camera did not reach adapter: '+JSON.stringify(state.agents['duck-1']));
stage='camera before stall';$('#pause').click();await wait(()=>t().time>state.time+.2);clearInterval(timer);testVideo.pause();stage='camera stall';await wait(()=>t().agents['duck-1'].input.fresh===false);$('#pause').click();await wait(()=>t().paused);check(t().ducks[0].command[0]===0,'Frozen native camera did not gate approach');receipts.push({check:'decoded camera stall while physics keeps running',capture:t().agents['duck-1'].vision?.capture,input:t().agents['duck-1'].input});
$('#webcam').click();check(stream.getTracks().every(t=>t.readyState==='ended'),'Camera not released');await loadPresetScene('target');return receipts;
