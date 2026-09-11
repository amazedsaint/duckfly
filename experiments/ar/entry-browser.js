async page=>{
 const origin=await page.evaluate(()=>location.origin),errors=[],check=(value,message)=>{if(!value)throw Error(message);};page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/?ar=1');await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>window.duckflyTelemetry?.ready&&document.querySelector('#ar-dialog')?.open,null,{timeout:60000});
 check(await page.evaluate(()=>window.duckflyTelemetry.scene.presentation?.view==='ar'&&!document.querySelector('#scene-setup').open),'AR entry did not create a ready scene');
 check(await page.locator('meta[name="description"]').getAttribute('content').then(s=>s.includes('19 available signals')),'Signal count is outdated');
 const options=await page.locator('#ar-dialog').evaluate(el=>({xrDisabled:el.querySelector('#ar-start').disabled,cameraDisabled:el.querySelector('#ar-camera').disabled,message:el.querySelector('#ar-support').textContent}));
 await page.screenshot({path:'output/playwright/ar-entry-phone.png'});
 await page.locator('#ar-cancel').click();check(await page.evaluate(()=>window.duckflyTelemetry.paused),'AR cancellation started the new scene');
 await page.locator('#back-home').click();check(await page.locator('[data-scenario]').count()===18,'Missing gallery experiments');
 await page.locator('[data-scenario="cue-workshop"]').click();await page.waitForFunction(()=>window.duckflyTelemetry.tick>=100&&!window.duckflyTelemetry.paused,null,{timeout:45000});
 check(!await page.locator('#scene-setup').evaluate(el=>el.open),'Prebuilt scene reopened the wizard');
 const before=await page.evaluate(()=>({tick:window.duckflyTelemetry.tick,distance:window.duckflyTelemetry.ducks[0].distance}));
 check(before.distance>.15,'Direct visual scene did not move the duck');
 await page.locator('#view-ar').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused&&document.querySelector('#ar-dialog').open);
 await page.locator('#ar-cancel').click();await page.waitForFunction(tick=>!window.duckflyTelemetry.paused&&window.duckflyTelemetry.tick>tick,before.tick);
 check(await page.evaluate(()=>!document.querySelector('#app').inert),'Returning from AR options disabled the studio');
 await page.locator('#back-home').click();await page.locator('[data-scenario="scent"]').click();await page.waitForFunction(()=>window.duckflyTelemetry.tick>=100&&!window.duckflyTelemetry.paused,null,{timeout:45000});
 await page.locator('#pause').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);
 const scent=await page.evaluate(()=>({eye:window.duckflyTelemetry.scene.ducks[0].eye,senses:window.duckflyTelemetry.agents['duck-1'].input.senses,distance:window.duckflyTelemetry.ducks[0].distance}));
 check(scent.eye==='none'&&scent.senses.scent.detected&&scent.distance>.15,'Published scent scene did not use its sensor');
 check(!errors.length,'Entry errors: '+errors.join('; '));
 return{format:'duckfly-ar-web-entry',passed:true,origin,options,directScene:before,scent,errors};
}
