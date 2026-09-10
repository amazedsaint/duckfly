async page => {
  await page.goto('http://127.0.0.1:5193/');await page.setViewportSize({width:1400,height:960});await page.waitForFunction(()=>window.duckflyTelemetry?.ready);
  await page.locator('[data-scenario="stop-go"]').click();await page.waitForFunction(()=>window.duckflyTelemetry.scene.lab?.id==='stop-go'&&window.duckflyTelemetry.time>.1);
  const trials=[],layouts=[];
  for(const condition of ['hold','timer','gf-off']) {
    await page.getByRole('combobox',{name:'Object path',exact:true}).selectOption('near-miss');
    await page.getByRole('combobox',{name:'Stop response',exact:true}).selectOption(condition);
    await page.getByRole('button',{name:'Restart experiment',exact:true}).click();
    await page.waitForFunction(c=>window.duckflyTelemetry.scene.lab.condition===c&&window.duckflyTelemetry.scene.seed==='tv-confirm-near-miss-15'&&window.duckflyTelemetry.tick===250&&window.duckflyTelemetry.paused,condition,{timeout:20000});
    const s=await page.evaluate(()=>window.duckflyTelemetry);trials.push({variant:'near-miss',condition,tick:s.tick,contacts:s.collisionCount,body:s.ducks[0],loop:s.agents['duck-1'].temporal});
    if(s.collisionCount!==0)throw Error('False-alarm example must be contact-free with and without GF');
    if(condition==='hold'&&s.agents['duck-1'].temporal.gfEvents!==2)throw Error('Expected the retained false-alarm response');
  }
  for(const [width,height] of [[1400,960],[1024,768],[390,844],[560,640]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(200);
    const result=await page.evaluate(()=>{
      const ids=['eye','brain-plot','guided-lab','arena'],boxes=Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{top:r.top,bottom:r.bottom,height:r.height}]}));
      const uncovered=['eye','brain-plot'].every(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e;});
      return {boxes,uncovered,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    if(result.overflow||!result.uncovered||['eye','brain-plot'].some(id=>result.boxes[id].top<0||result.boxes[id].bottom>height))throw Error('Brain or eyes obscured at '+width+'x'+height+JSON.stringify(result));
    await page.screenshot({path:`output/playwright/stop-go-${width}.png`});layouts.push({width,height,...result});
  }
  await page.setViewportSize({width:1400,height:960});
  await page.getByRole('button',{name:'Back to scenarios'}).click();await page.screenshot({path:'output/playwright/guided-home-final.png',fullPage:true});
  return {pass:true,trials,layouts};
}
