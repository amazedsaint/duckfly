async page => {
  const check=(value,message)=>{if(!value)throw Error(message);};
  const origin=await page.evaluate(()=>location.origin),errors=[],views=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(()=>window.duckflyTelemetry?.ready,null,{timeout:60000});
  for(const [width,height] of [[1440,1000],[1280,800],[390,844],[320,740]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>window.scrollTo(0,0));
    const layout=await page.evaluate(()=>{
      const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const wordmark=[...document.querySelector('.launch-title').children].map(span=>{const range=document.createRange();range.selectNodeContents(span.firstChild);const r=range.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
      return {overflow:document.documentElement.scrollWidth>innerWidth+1,title:rect('.launch-title'),wordmark,headline:rect('.launch-copy h2'),primary:rect('#launch-enter'),secondary:rect('#launch-beacon'),text:document.querySelector('.launch-description').textContent};
    });
    check(!layout.overflow,'Launch overflow at '+width);
    check(layout.text.includes('13 available signals')&&layout.text.includes('10 robot actions'),'Launch mapping counts missing');
    if(width>=1000)check(layout.primary.bottom<=height&&layout.secondary.bottom<=height,'Desktop launch buttons are below the viewport');
    await page.screenshot({path:`output/playwright/product-copy-launch-${width}.png`,fullPage:true});
    views.push({width,height,layout});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Try a connection',exact:true}).click();
  check(await page.locator('#setup-title').textContent()==='Build a visual follower','Quick start selected the wrong scene');
  await page.getByRole('button',{name:'Continue →',exact:true}).click();
  check(await page.locator('#scene-setup [data-connection="trigger"]').first().locator('option').count()===13,'Wizard does not offer 13 signals');
  check(await page.locator('#scene-setup [data-connection="action"]').first().locator('option').count()===10,'Wizard does not offer 10 actions');
  await page.screenshot({path:'output/playwright/product-copy-setup-desktop.png'});
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    check(await page.locator('#scene-setup').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Setup overflow at '+width);
    await page.screenshot({path:`output/playwright/product-copy-setup-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  for(let i=0;i<2;i++)await page.getByRole('button',{name:'Continue →',exact:true}).click();
  await page.getByRole('button',{name:'Start scene',exact:true}).click();
  await page.waitForFunction(()=>window.duckflyTelemetry.time>1);
  await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();
  await page.waitForFunction(()=>window.duckflyTelemetry.paused);
  await page.locator('#panel-connections').click();
  const pair=await page.locator('#custom-connections .connection-pair').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns);
  check(pair.trim().split(/\s+/).length===1,'Narrow editor does not stack signal and action fields');
  check(await page.locator('#custom-connections [data-connection="trigger"]').first().locator('option').count()===13,'Editor signal catalog differs from setup');
  await page.screenshot({path:'output/playwright/product-copy-editor-desktop.png'});
  await page.getByRole('button',{name:'Why?',exact:true}).click();
  await page.locator('#event-dialog .action-details > summary').click();
  const detail=await page.locator('#event-signals').textContent();
  check(detail.includes('Walking activity · DNp09')&&detail.includes('Walk forward'),'Recorded actions use raw identifiers instead of product labels');
  await page.screenshot({path:'output/playwright/product-copy-action-details.png'});
  await page.getByRole('button',{name:'Close action inspector'}).click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/playwright/product-copy-editor-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#back-home').click();
  await page.screenshot({path:'output/playwright/product-copy-scenes.png',fullPage:true});
  check(errors.length===0,'Page errors: '+errors.join('; '));
  return {format:'duckfly-product-copy-visual',origin,passed:true,views,signalCount:13,actionCount:10,errors};
}
