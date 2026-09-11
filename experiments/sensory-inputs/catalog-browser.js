async page => {
  const checks=[],errors=[],check=(ok,message)=>{if(!ok)throw Error(message);};
  const onError=error=>errors.push(error.message);page.on('pageerror',onError);
  try{
    const origin=await page.evaluate(()=>location.origin);
    await page.goto(origin);await page.setViewportSize({width:1440,height:1000});
    await page.waitForFunction(()=>window.duckflyTelemetry?.ready,null,{timeout:60000});
    await page.locator('#launch-enter').click();
    const tiles=await page.locator('[data-scenario]').evaluateAll(els=>els.map(el=>({id:el.dataset.scenario,title:el.querySelector('h3').textContent})));
    check(tiles.length===18,'The gallery must retain all scenes');
    for(const tile of tiles){
      await page.locator(`[data-scenario="${tile.id}"]`).click();
      if(tile.id==='empty'){
        await page.waitForFunction(()=>document.querySelector('#scene-setup').open);
        for(let step=0;step<3;step++)await page.locator('[data-setup-action="next"]').click();
        await page.locator('[data-setup-action="apply"]').click();
      }
      await page.waitForFunction(name=>{
        const t=window.duckflyTelemetry;return t.scene.name===name&&!t.paused&&t.tick>=250&&!document.querySelector('#experiment-page').hidden;
      },tile.id==='empty'?'Open arena':tile.title,{timeout:45000});
      check(!await page.locator('#scene-setup').evaluate(el=>el.open),'Prebuilt scene opened setup: '+tile.id);
      await page.locator('#pause').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);
      const sample=await page.evaluate(()=>{
        const t=window.duckflyTelemetry,brain=document.querySelector('#brain-plot').getBoundingClientRect(),eye=document.querySelector('#eye').getBoundingClientRect();
        return{tick:t.tick,scene:t.scene.name,duckCount:t.ducks.length,ducks:t.ducks.map(b=>({id:b.id,position:b.position,distance:b.distance,fallen:b.fallen,command:b.command})),brainVisible:brain.width>0&&brain.top>=0&&brain.bottom<=innerHeight,eyeVisible:eye.width>0&&eye.top>=0&&eye.bottom<=innerHeight};
      });
      check(sample.ducks.every(b=>!b.fallen&&b.command.every(Number.isFinite)),'Unstable default scene: '+tile.id);
      check(sample.brainVisible&&sample.eyeVisible,'A live monitor left the viewport: '+tile.id);
      await page.locator('#panel-connections').click();
      check(await page.locator('#brain-mapping-panel .trigger-connections').count()===1,'Missing connection editor: '+tile.id);
      check(await page.locator('#brain-mapping-panel .connection-rule').count()>0,'No ready connection rows: '+tile.id);
      checks.push({id:tile.id,entry:tile.id==='empty'?'wizard':'direct',...sample});
      await page.locator('#back-home').click();
    }
    await page.locator('[data-customize-scenario="scent"]').click();
    await page.waitForFunction(()=>document.querySelector('#scene-setup').open);
    check(await page.locator('#setup-title').textContent()==='Follow a scent','Customize opened the wrong scene');
    await page.locator('[data-setup-action="next"]').click();
    await page.locator('#scene-setup .connection-composer > summary').click();
    check(await page.locator('#scene-setup [data-connection="draft-trigger"] option').count()===20,'Missing sensory signals in setup');
    check(await page.locator('#scene-setup [data-connection="draft-action"] option').count()===11,'Missing robot actions in setup');
    await page.locator('[data-setup-action="cancel"]').click();
    check(!await page.locator('#scene-catalog').evaluate(el=>el.hidden),'Cancel did not return to the gallery');
    await page.locator('[data-scenario-filter="senses"]').click();
    const filtered=await page.locator('.scenario-card:not([hidden]) [data-scenario]').evaluateAll(els=>els.map(el=>el.dataset.scenario));
    check(filtered.join(',')==='scent,air,touch,vision','Sensory filter has the wrong scenes');
    for(const width of [1440,1280,390,320]){
      await page.setViewportSize({width,height:width<500?844:1000});
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Gallery overflows at '+width);
      await page.screenshot({path:`output/playwright/senses-catalog-${width}.png`});
    }
    check(!errors.length,'Browser errors: '+errors.join('; '));
    return {format:'duckfly-direct-scene-acceptance',origin,checks,customize:true,filtered,errors,passed:true};
  }finally{page.off('pageerror',onError);}
}
