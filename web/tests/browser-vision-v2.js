async (page) => {
  const receipts=[],check=(v,m)=>{if(!v)throw Error(m);};
  await page.addInitScript(()=>{
    const WorkerClass=window.Worker;window.Worker=class extends WorkerClass{constructor(url,options){super(url,options);if(String(url).includes('lab.worker')){window.__labWorker=this;this.addEventListener('message',({data})=>{if(data.type==='job-result')window.__loomReport=data.report;});}}};
    window.__cameraRequests=0;
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      window.__cameraRequests++;const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;const ctx=canvas.getContext('2d');
      const draw=()=>{ctx.fillStyle='#777';ctx.fillRect(0,0,96,64);ctx.fillStyle='#f02882';ctx.fillRect(32,22,16,18);};draw();
      const stream=canvas.captureStream(25);window.__cameraTimer=setInterval(draw,40);window.__cameraStream=stream;return stream;
    }});
  });
  await page.goto('http://127.0.0.1:4173/');await page.waitForFunction(()=>window.duckflyTelemetry?.ready);
  const preset=async name=>{await page.locator('#preset').selectOption(name);await page.waitForFunction(()=>window.duckflyTelemetry.time===0&&window.duckflyTelemetry.paused);};
  const run=async seconds=>{const start=await page.evaluate(()=>window.duckflyTelemetry.time);await page.locator('#pause').click();await page.waitForFunction(t=>window.duckflyTelemetry.time>=t,start+seconds);await page.locator('#pause').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);return page.evaluate(()=>window.duckflyTelemetry);};
  await preset('vision');let s=await run(3);check(!s.ducks[0].fallen&&s.ducks[0].position[0]>.15,'New retinal cameras must preserve target approach');
  check(s.event.causes[0].provenance.forward,'Action origin missing');check(s.agents['duck-1'].vision.capture.clock==='simulation','Simulation clock missing');
  receipts.push({check:'stereo camera approach',position:s.ducks[0].position,capture:s.agents['duck-1'].vision.capture});
  await page.locator('#eyes').selectOption('none');s=await run(.2);check(!s.agents['duck-1'].vision.target.visible&&s.ducks[0].command[0]===0,'Covering both eyes must gate approach');
  await preset('occlusion');s=await run(.2);check(!s.agents['duck-1'].vision.target.visible,'Stereo views must respect physical occlusion');receipts.push({check:'eye covering and wall occlusion'});
  await preset('target');check(await page.evaluate(()=>window.__cameraRequests===0),'Camera requested without click');
  await page.locator('#webcam').click();await page.waitForFunction(()=>document.querySelector('#webcam').textContent==='Stop webcam');await page.locator('#source').selectOption('webcam');s=await run(.6);
  check(s.agents['duck-1'].vision?.target.visible&&s.agents['duck-1'].input.forward>0,'Decoded synthetic camera must reach adapter');
  const id=s.agents['duck-1'].vision.capture.frameId;await page.evaluate(()=>clearInterval(window.__cameraTimer));
  await page.locator('#pause').click();await page.waitForFunction(()=>window.duckflyTelemetry.time>1&&window.duckflyTelemetry.agents['duck-1'].input.fresh===false);
  await page.locator('#pause').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);
  s=await page.evaluate(()=>window.duckflyTelemetry);check(s.ducks[0].command[0]===0,'Frozen webcam did not stop camera-driven approach');
  receipts.push({check:'real decoded-frame freeze and resume freshness',lastFrameId:id,after:s.agents['duck-1'].vision?.capture??null,input:s.agents['duck-1'].input});
  await page.locator('#webcam').click();check(await page.evaluate(()=>window.__cameraStream.getTracks().every(t=>t.readyState==='ended')),'Camera tracks not released');
  await preset('target');await page.getByText('Experiment tools',{exact:true}).click();await page.locator('#vision-bench').click();await page.locator('#bench-gain').fill('10');await page.locator('#bench-run').click();await page.waitForFunction(()=>window.duckflyVisionBench?.model==='motion-opponency-v1');
  let r=await page.evaluate(()=>window.duckflyVisionBench);check(r.trace.some(t=>t.loomL>.5)&&r.trace.some(t=>t.gfStop),'Explicit gain 10 bench did not reach GF');receipts.push({check:'live retinal bench and GF',peak:Math.max(...r.trace.map(t=>t.loomL))});
  await page.locator('#bench-model').selectOption('flyvis-000');await page.locator('#bench-run').click();await page.waitForFunction(()=>window.duckflyVisionBench?.model==='flyvis-000',{timeout:45000});r=await page.evaluate(()=>window.duckflyVisionBench);check(r.validation.numericalParity&&!r.validation.bodyBridge,'Reference promotion status incorrect');check(r.trace.some(t=>Object.values(t.populations).some(v=>v>.01)),'Flyvis has no visual response');receipts.push({check:'full Flyvis WASM in Chromium',timing:r.loopTimingMs});
  await page.screenshot({path:'output/playwright/flyvis-reference.png'});await page.locator('#bench-close').click();
  await page.evaluate(()=>window.__labWorker.postMessage({type:'loom-compare',id:'duck-1',seeds:2}));
  await page.waitForFunction(()=>window.__loomReport?.format==='duckfly-looming-comparison',null,{timeout:180000});
  const comparison=await page.evaluate(()=>window.__loomReport);check(comparison.rows.every(r=>r.trials.length===4),'Matched physical trials incomplete');
  receipts.push({check:'16 matched physical trials',report:comparison});
  await preset('target');return receipts;
}
