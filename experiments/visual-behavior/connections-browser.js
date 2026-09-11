async page => {
  const check=(v,m)=>{if(!v)throw Error(m);},receipts=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const origin=await page.evaluate(()=>location.origin);
  for(const id of ['cue-workshop','lookout','crossed-wires','trigger-kick']){
    await page.goto(origin);await page.setViewportSize({width:1440,height:1000});
    await page.waitForFunction(()=>window.duckflyTelemetry?.ready,null,{timeout:60000});
    await page.getByRole('button',{name:'Open studio',exact:true}).click();
    check(await page.locator(`[data-scenario="${id}"] img`).evaluate(img=>img.complete&&img.naturalWidth>0),'Missing scene image '+id);
    await page.locator(`[data-scenario="${id}"]`).click();
    await page.getByRole('button',{name:'Continue →',exact:true}).click();
    check(await page.locator('#scene-setup [data-connection="enabled"]').count()===0&&await page.locator('#scene-setup [data-rule]').count()>0,'Scene connections are not ready to edit');
    if(id==='cue-workshop'){
      await page.locator('#scene-setup [data-rule="connection-1"] [data-connection="action"]').selectOption('look-left');
      await page.screenshot({path:'output/playwright/trigger-wizard-desktop.png'});
      await page.setViewportSize({width:390,height:844});
      check(await page.locator('#scene-setup').evaluate(el=>el.scrollWidth-el.clientWidth<=1),'Wizard horizontal overflow');
      await page.screenshot({path:'output/playwright/trigger-wizard-mobile.png'});
      await page.setViewportSize({width:1440,height:1000});
    }
    if(id==='cue-workshop'){
      await page.locator('#scene-setup [data-rule="connection-1"] details > summary').click();
      await page.locator('#scene-setup [data-rule="connection-1"] [data-connection="threshold"]').fill('8');
    }
    for(let i=0;i<2;i++){await page.getByRole('button',{name:'Continue →',exact:true}).click();await page.waitForSelector(`[data-setup-step="${i+2}"]`);}
    await page.getByRole('button',{name:'Start scene',exact:true}).click();
    if(id==='trigger-kick')await page.waitForFunction(()=>window.duckflyTelemetry.event?.causes[0]?.command.policy==='kick',null,{timeout:30000});
    else await page.waitForFunction(()=>window.duckflyTelemetry.time>2,null,{timeout:30000});
    await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();
    await page.waitForFunction(()=>window.duckflyTelemetry.paused);
    let state=await page.evaluate(()=>window.duckflyTelemetry);
    check(state.scene.version===7,'Connections were silently downgraded');
    check(state.event.causes.every(c=>c.connections?.signals.length),'Connection evidence missing');
    check(state.ducks.every(d=>!d.fallen),'New scene fell during launch: '+id);
    if(id==='cue-workshop'){
      check(state.scene.ducks[0].connections.rules[0].threshold===8,'Wizard lost the numeric edit before Continue');
      check(state.scene.ducks[0].connections.rules[0].action==='look-left','Wizard mapping was lost');
      check(state.ducks[0].command[0]===0,'Head mapping started walking');
      await page.locator('#panel-connections').click();
      await page.locator('#brain-mapping-panel [data-rule="connection-1"] [data-connection="action"]').selectOption('walk');
      await page.waitForFunction(()=>window.duckflyTelemetry.scene.ducks[0].connections.rules[0].action==='walk');
      await page.locator('#brain-mapping-panel [data-rule="connection-1"] details > summary').click();
      await page.locator('#brain-mapping-panel [data-rule="connection-1"] [data-connection="threshold"]').fill('9');
      await page.locator('#brain-mapping-panel .connection-composer > summary').click();
      await page.locator('#brain-mapping-panel [data-connection="draft-trigger"]').selectOption('seen');
      await page.locator('#brain-mapping-panel [data-connection="draft-action"]').selectOption('look-cue');
      await page.locator('#brain-mapping-panel [data-connection="add"]').click();
      await page.waitForFunction(()=>window.duckflyTelemetry.scene.ducks[0].connections.rules.length===4);
      check(await page.evaluate(()=>window.duckflyTelemetry.scene.ducks[0].connections.rules[0].threshold===9),'Editor lost threshold when adding a connection');
      await page.locator('#brain-mapping-panel [data-rule="connection-4"] [data-connection="remove"]').click();
      await page.waitForFunction(()=>window.duckflyTelemetry.scene.ducks[0].connections.rules.length===3);
      const time=state.time;
      await page.getByRole('button',{name:'▶ Run',exact:true}).click();
      await page.waitForFunction(t=>window.duckflyTelemetry.time>t+1.5,time);
      await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);
      state=await page.evaluate(()=>window.duckflyTelemetry);
      check(state.ducks[0].distance>.1,'Edited walking connection did not move the body');
      check(state.event.causes[0].connections.signals.some(signal=>signal.active),'Live signal activity did not update');
      check((await page.locator('#brain-mapping-panel .connection-runtime').textContent()).includes('paused'),'Paused scene still looks live');
      await page.screenshot({path:'output/playwright/trigger-editor-desktop.png'});
      await page.setViewportSize({width:390,height:844});
      check(await page.locator('#brain-mapping-panel').evaluate(el=>el.scrollWidth-el.clientWidth<=1),'Connection panel horizontal overflow');
      await page.screenshot({path:'output/playwright/trigger-editor-mobile.png'});
      await page.setViewportSize({width:1440,height:1000});
      await page.getByRole('button',{name:'Why?',exact:true}).click();
      await page.locator('#event-dialog .action-details > summary').click();
      check((await page.locator('#event-signals').textContent()).includes('Signal connections'),'Recorded action omitted trigger decisions');
      await page.getByRole('button',{name:'Close action inspector'}).click();
    }
    if(id==='lookout')check(state.ducks[0].command[0]===0&&state.ducks[0].command[1]===0,'Lookout moved its body');
    if(id==='crossed-wires')check(state.scene.ducks[0].connections.rules[0].action!==state.scene.ducks[1].connections.rules[0].action,'Independent mappings merged');
    receipts.push({id,time:state.time,ducks:state.ducks.map(d=>({id:d.id,distance:d.distance,fallen:d.fallen,command:d.command})),rules:state.scene.ducks.map(d=>d.connections.rules),recordedSignals:state.event.causes.map(c=>c.connections.signals)});
  }
  check(!errors.length,'Page errors: '+errors.join('; '));
  return {format:'duckfly-trigger-connections-browser',receipts,errors,passed:true};
}
