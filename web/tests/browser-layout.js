async (page) => {
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  await page.waitForFunction(()=>window.duckflyTelemetry?.ready,{},{timeout:15000});
  const context=page.context();
  try{
    await context.setOffline(true);
    if((await page.evaluate(()=>window.duckflyTelemetry.paused)))await page.getByRole('button',{name:'▶ Resume',exact:true}).click();
    await page.getByRole('button',{name:'↑ Walk',exact:true}).click();
    const before=await page.evaluate(()=>window.duckflyTelemetry);
    await page.waitForFunction(t=>window.duckflyTelemetry.time>t+1,before.time,{timeout:10000});
    const after=await page.evaluate(()=>window.duckflyTelemetry);
    check(after.distance>before.distance,'Offline simulation did not move');
    await page.screenshot({path:'output/playwright/duckfly-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(200);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Narrow layout overflows horizontally');
    await page.screenshot({path:'output/playwright/duckfly-mobile.png',fullPage:true});
    return {pass:true,offlineBefore:before,offlineAfter:after,narrowViewport:{width:390,height:844,horizontalOverflow:false}};
  }finally{await context.setOffline(false);await page.setViewportSize({width:1400,height:960});}
}
