async page=>{
 await page.goto('http://127.0.0.1:5195/');await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>window.duckflyTelemetry?.ready);await page.locator('#launch-enter').click();await page.locator('[data-scenario="scent"]').click();await page.waitForFunction(()=>window.duckflyTelemetry.tick>=15);await page.locator('#pause').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);await page.screenshot({path:'output/playwright/scent-drag-before.png'});
 const before=await page.evaluate(()=>({tick:window.duckflyTelemetry.tick,field:window.duckflyTelemetry.scene.fields[0]}));
 await page.mouse.move(785,608);await page.mouse.down();await page.mouse.move(695,580,{steps:8});await page.mouse.up();
 await page.waitForFunction(previous=>window.duckflyTelemetry.selected==='scent-1'&&JSON.stringify(window.duckflyTelemetry.scene.fields[0].position)!==JSON.stringify(previous),before.field.position);
 const after=await page.evaluate(()=>({tick:window.duckflyTelemetry.tick,field:window.duckflyTelemetry.scene.fields[0],selected:window.duckflyTelemetry.selected,connectedDuck:window.duckflyTelemetry.connectedDuck}));
 if(before.tick!==after.tick||JSON.stringify(before.field.position)===JSON.stringify(after.field.position)||after.connectedDuck!=='duck-1')throw Error('Source drag did not preserve the live run');
 await page.screenshot({path:'output/playwright/scent-drag-after.png'});return{format:'duckfly-source-drag',passed:true,viewport:[1440,1000],gesture:{from:[785,608],to:[695,580]},before,after};
}
