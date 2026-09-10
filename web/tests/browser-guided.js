async (page) => {
  const receipt={format:'duckfly-guided-acceptance',version:1,checks:[],trials:[]};
  const check=(value,message)=>{if(!value)throw Error(message);};
  const t=()=>page.evaluate(()=>window.duckflyTelemetry);
  await page.goto('http://127.0.0.1:5192/');
  await page.setViewportSize({width:1400,height:960});
  await page.waitForFunction(()=>window.duckflyTelemetry?.ready);
  const choose=async id=>{
    if(await page.getByRole('button',{name:'Back to scenarios'}).isVisible())await page.getByRole('button',{name:'Back to scenarios'}).click();
    await page.locator(`[data-scenario="${id}"]`).click();
    await page.waitForFunction(id=>window.duckflyTelemetry.scene.lab?.id===id&&window.duckflyTelemetry.time>.1,id);
  };
  const pause=async()=>{if(!(await t()).paused)await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);};
  const advance=async seconds=>{
    const before=await t();if(before.paused)await page.getByRole('button',{name:'▶ Run',exact:true}).click();
    await page.waitForFunction(time=>window.duckflyTelemetry.time>=time,before.time+seconds,{timeout:15000});await pause();return t();
  };
  check(await page.locator('[data-scenario]').count()===10,'Expected ten scenario tiles');
  check(await page.locator('.scenario-image img').evaluateAll(els=>els.every(e=>e.complete&&e.naturalWidth>0)),'Scenario thumbnails failed');
  await choose('stop-go');
  for(const variant of ['incoming','near-miss','receding','retreat'])for(const condition of ['hold','timer','gf-off']){
    await page.evaluate(({variant,condition})=>window.guidedTestStage={variant,condition},{variant,condition});
    await page.getByRole('combobox',{name:'Object path',exact:true}).selectOption(variant);
    await page.getByRole('combobox',{name:'Stop response',exact:true}).selectOption(condition);
    await page.getByRole('button',{name:'Restart experiment',exact:true}).click();
    await page.waitForFunction(({v,c})=>window.duckflyTelemetry.scene.lab.variant===v&&window.duckflyTelemetry.scene.lab.condition===c&&window.duckflyTelemetry.tick===250&&window.duckflyTelemetry.paused,{v:variant,c:condition},{timeout:20000});
    const s=await t();receipt.trials.push({variant,condition,tick:s.tick,contacts:s.collisionCount,body:s.ducks[0],loop:s.agents['duck-1'].temporal});
    await page.evaluate(r=>window.guidedTestProgress=r,receipt);
    check(!s.ducks[0].fallen,'Playable stop trial fell');
    if(condition==='gf-off')check(s.agents['duck-1'].temporal.gfEvents===0&&!s.agents['duck-1'].temporal.held,'GF lesion must prevent hold');
  }
  const incoming=receipt.trials.filter(r=>r.variant==='incoming');
  check(incoming.find(r=>r.condition==='hold').contacts===0,'Hazard hold contacted the incoming object');
  check(incoming.find(r=>r.condition==='timer').contacts>0,'Timer failure example did not reproduce');
  check(incoming.find(r=>r.condition==='hold').loop.releases===1,'Hold must eventually release');
  receipt.checks.push('12 rendered-camera physical examples and GF disconnection');
  await page.getByRole('combobox',{name:'Object path',exact:true}).selectOption('incoming');
  await page.getByRole('combobox',{name:'Stop response',exact:true}).selectOption('hold');
  await page.getByRole('button',{name:'Restart experiment',exact:true}).click();
  await page.waitForFunction(()=>window.duckflyTelemetry.agents['duck-1'].temporal?.held);
  await page.getByRole('button',{name:'Cover eyes',exact:true}).click();
  await page.waitForFunction(()=>window.duckflyTelemetry.scene.ducks[0].eye==='none'&&!window.duckflyTelemetry.agents['duck-1'].temporal.fresh);
  let s=await advance(.3);check(s.agents['duck-1'].temporal.held,'Covering eyes must not release hold');
  await page.getByRole('button',{name:'Uncover eyes',exact:true}).click();
  s=await advance(.3);check(s.agents['duck-1'].temporal.fresh,'Stereo must recover after uncover');
  receipt.checks.push('Eye cover invalidates decoder evidence while preserving an existing GF hold');
  await choose('gaze');await pause();
  await page.getByRole('button',{name:'Beacon right',exact:true}).click();s=await advance(.2);check(s.scene.props.find(p=>p.id==='target-1').position[1]<0,'Beacon action must move a physical prop');
  await page.getByRole('button',{name:'Hide beacon',exact:true}).click();s=await advance(.5);
  check(!s.agents['duck-1'].vision.target.visible&&s.ducks[0].command[0]===0,'Wall must occlude camera and gate forward command');
  await page.getByRole('button',{name:'Active looking: on',exact:true}).click();s=await advance(.1);check(!s.scene.ducks[0].activeLook,'Active looking must toggle');
  await page.getByRole('button',{name:'Reveal beacon',exact:true}).click();s=await advance(.3);
  receipt.checks.push('Gaze controls move physical beacon and occluder; covered target removes drive');
  await choose('switchboard');await pause();
  await page.getByRole('button',{name:'Cut body commands',exact:true}).click();s=await advance(.3);
  check(s.ducks[0].command.every(v=>v===0)&&s.agents['duck-1'].neural.spikeCount>0,'Output lesion must stop commands while neurons continue');
  await page.getByRole('button',{name:'Cut forward neurons',exact:true}).click();s=await advance(.3);
  check(s.scene.ducks[0].silence==='forward','Forward lesion did not reach worker');
  await page.getByRole('button',{name:'Connect all',exact:true}).click();s=await advance(.3);check(s.scene.ducks[0].silence==='none','Restoration failed');
  receipt.checks.push('Switchboard cuts real commands and selected neural groups; reconnect works');
  await choose('recovery');s=await advance(.5);const before=s.ducks[0];
  await page.getByRole('button',{name:'Nudge duck',exact:true}).click();s=await advance(.25);check(Math.abs(s.ducks[0].position[1]-before.position[1])>.005,'Nudge must physically perturb the body');
  await page.getByRole('button',{name:'Feedback to fly brain: on',exact:true}).click();s=await advance(.2);check(!s.scene.ducks[0].feedback,'Feedback toggle failed');
  receipt.checks.push({check:'Body nudge and circuit feedback control',before,after:s.ducks[0]});
  for(const [width,height] of [[1400,960],[1024,768],[390,844]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(150);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
    const boxes=await page.evaluate(()=>Object.fromEntries(['eye','brain-plot','guided-lab','arena'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{top:r.top,bottom:r.bottom,height:r.height}];})));
    for(const id of ['eye','brain-plot'])check(boxes[id].height>0&&boxes[id].top>=0&&boxes[id].bottom<=height,`${id} not visible at ${width}`);
    await page.screenshot({path:`output/playwright/guided-${width}.png`});receipt.checks.push({check:'Layout',width,height,boxes});
  }
  await page.setViewportSize({width:1400,height:960});
  return receipt;
}
