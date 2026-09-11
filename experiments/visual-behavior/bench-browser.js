async page => {
  const check=(condition,message)=>{if(!condition)throw Error(message);},receipts=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(await page.evaluate(()=>location.origin));
  await page.waitForFunction(()=>window.duckflyTelemetry?.ready,null,{timeout:60000});
  await page.getByRole('button',{name:'Try the beacon',exact:true}).click();
  for(let step=0;step<3;step++)await page.getByRole('button',{name:'Continue →',exact:true}).click();
  await page.getByRole('button',{name:'Start scene',exact:true}).click();
  await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();
  await page.waitForFunction(()=>window.duckflyTelemetry.paused);
  const initialTime=await page.evaluate(()=>window.duckflyTelemetry.time);
  const advanced=page.getByRole('button',{name:'Advanced',exact:true});
  if(await advanced.getAttribute('aria-expanded')!=='true')await advanced.click();
  if(!await page.locator('#scene-settings-panel').evaluate(element=>element.open))await page.locator('#scene-settings-panel > summary').click();
  const experimentTools=page.getByText('Experiment tools',{exact:true});
  if(!await experimentTools.evaluate(element=>element.parentElement.open))await experimentTools.click();
  await page.getByRole('button',{name:'Vision test bench',exact:true}).click();
  await page.locator('#bench-model').selectOption('flyvis-000');
  await page.locator('#bench-stimulus').selectOption('edge-off');
  await page.locator('#bench-run').click();
  await page.waitForFunction(()=>window.duckflyVisionBench?.version===2,null,{timeout:60000});
  const result=await page.evaluate(()=>{
    const r=window.duckflyVisionBench,types=Object.keys(r.spatialMetadata.populations);
    let negatives=0,positives=0,maximumError=0;
    for(const frame of r.trace)for(const type of types){
      const p=frame.spatial.populations[type],baseline=r.baseline.populations[type];
      if(p.raw.length!==721||p.delta.length!==721)throw Error('Spatial map lost locations');
      for(let i=0;i<721;i++){
        if(p.delta[i]<0)negatives++;if(p.delta[i]>0)positives++;
        maximumError=Math.max(maximumError,Math.abs(p.delta[i]-Math.fround(p.raw[i]-baseline[i])));
      }
    }
    return {format:r.format,version:r.version,frames:r.trace.length,types,negatives,positives,maximumError,timing:r.loopTimingMs,
      bridge:r.validation.bodyBridge,simulatedGF:r.trace.some(frame=>frame.gfStop!==null),baselineSeconds:r.baseline.conditioningSeconds};
  });
  check(result.frames===31&&result.types.length===8,'Full spatial recording incomplete');
  check(result.negatives>0&&result.positives>0&&result.maximumError===0,'Signed responses or baseline subtraction changed');
  check(!result.bridge&&!result.simulatedGF&&result.baselineSeconds===1,'Reference claims an unvalidated bridge or incorrect baseline');
  check(await page.evaluate(()=>window.duckflyTelemetry.time)===initialTime,'Bench changed the paused body experiment');
  receipts.push({check:'real packaged Flyvis spatial response and body isolation',...result});
  await page.locator('#spatial-frame').fill('8');
  await page.locator('.spatial-cell > summary').click();
  await page.locator('#spatial-population').selectOption('T5b');
  await page.locator('#spatial-cell').fill('210');
  const inspected=await page.evaluate(()=>({
    text:document.querySelector('#spatial-values').textContent,
    expected:window.duckflyVisionBench.trace[8].spatial.populations.T5b.delta[210].toFixed(4),
    follow:document.querySelector('#spatial-follow').checked,
    time:document.querySelector('#spatial-time').textContent,
  }));
  check(!inspected.follow&&inspected.time.includes('0.32 s')&&inspected.text.includes(`change ${inspected.expected}`),'Recorded cell inspection differs from exported response');
  receipts.push({check:'recorded frame and cell inspection',...inspected});
  await page.locator('.spatial-maps').scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/spatial-bench-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.locator('#vision-bench-dialog').evaluate(element=>({width:element.getBoundingClientRect().width,overflow:element.scrollWidth-element.clientWidth}));
  check(mobile.width<=390&&mobile.overflow<=1,'Spatial bench overflows the mobile viewport');
  await page.locator('.spatial-maps').scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/spatial-bench-mobile.png'});
  receipts.push({check:'mobile spatial maps fit viewport',...mobile});
  await page.setViewportSize({width:1280,height:900});
  // Cancelling releases the worker; a new run starts with a fresh baseline.
  await page.locator('#bench-run').click();
  await page.locator('#bench-close').click();
  await page.getByRole('button',{name:'Vision test bench',exact:true}).click();
  check(await page.locator('#bench-run').isEnabled(),'Cancelled reference left the bench locked');
  await page.locator('#bench-model').selectOption('motion-opponency-v1');
  await page.locator('#bench-stimulus').selectOption('expand-off');
  await page.locator('#bench-gain').fill('10');
  await page.locator('#bench-run').click();
  await page.waitForFunction(()=>window.duckflyVisionBench?.model==='motion-opponency-v1',null,{timeout:15000});
  const compact=await page.evaluate(()=>({spatialHidden:document.querySelector('#bench-spatial').hidden,stopped:window.duckflyVisionBench.trace.some(frame=>frame.gfStop)}));
  check(compact.spatialHidden&&compact.stopped,'Compact pathway did not recover after reference cancellation');
  receipts.push({check:'cancellation and compact GF comparison',...compact});
  // Tampering with the requested reference must produce an error, not a trace.
  const route='**/assets/Vision/flyvis-000/manifest.json';
  await page.context().route(route,async request=>{
    const response=await request.fetch(),json=await response.json();json.checkpointSha256='0'.repeat(64);
    await request.fulfill({response,json});
  });
  try{
    await page.locator('#bench-model').selectOption('flyvis-000');
    await page.locator('#bench-run').click();
    await page.waitForFunction(()=>document.querySelector('#bench-status').textContent.includes('differs from the pinned export'),null,{timeout:30000});
    check(await page.evaluate(()=>window.duckflyVisionBench===null),'Corrupt model retained a successful trace');
    check(await page.locator('#bench-save').isDisabled(),'Corrupt model enabled trace export');
    receipts.push({check:'corrupt reference rejected with no successful trace'});
  }finally{await page.context().unroute(route);}
  await page.locator('#bench-close').click();
  check(errors.length===0,`Browser errors: ${errors.join('; ')}`);
  const report={format:'duckfly-spatial-bench-browser',passed:true,receipts,errors};
  await page.evaluate(value=>{window.duckflySpatialAcceptance=value;},report);
  return report;
}
