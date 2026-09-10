async (page) => {
  const results=[];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const assert=(v,m)=>{if(!v)throw Error(m);};
  const t=()=>page.evaluate(()=>window.duckflyTelemetry);
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(()=>window.duckflyTelemetry?.ready);
  const load=async scene=>{
    await page.evaluate(value=>{const data=new DataTransfer();data.items.add(new File([JSON.stringify(value)],'experiment.json',{type:'application/json'}));const input=document.querySelector('#file');input.files=data.files;input.dispatchEvent(new Event('change'));},scene);
    await page.waitForFunction(name=>duckflyTelemetry.scene.name===name&&duckflyTelemetry.time===0,scene.name);
  };
  const run=async seconds=>{
    const start=(await t()).time;await page.getByRole('button',{name:'▶ Run',exact:true}).click();
    await page.waitForFunction(time=>duckflyTelemetry.time>=time,start+seconds,{timeout:30000});
    if(!(await t()).paused)await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();
    await page.waitForFunction(()=>duckflyTelemetry.paused);return t();
  };
  await page.getByRole('combobox',{name:'Experiment preset'}).selectOption('target');
  await page.waitForFunction(()=>duckflyTelemetry.scene.name==='Follow the beacon'&&duckflyTelemetry.time===0);
  const base=clone((await t()).scene);
  const before=await run(2.1);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export recording',exact:true}).click();
  const record=await download;await record.saveAs('docs/implementation/roundtrip-recording.json');
  await page.getByRole('button',{name:'↺ Reset',exact:true}).click();await page.waitForFunction(()=>duckflyTelemetry.time===0);
  await page.locator('#file').setInputFiles('docs/implementation/roundtrip-recording.json');
  await page.waitForFunction(time=>duckflyTelemetry.time===time,before.time);
  const restored=await t();assert(JSON.stringify(restored.ducks)===JSON.stringify(before.ducks),'Recording import changed physical state');
  assert(JSON.stringify(restored.agents)===JSON.stringify(before.agents),'Recording import changed neural or sensory state');
  results.push({check:'recording UI export/import',time:restored.time,identicalBodyAndBrain:true});
  await page.getByRole('button',{name:/Target visible through camera/}).click();
  const eventText=await page.locator('#event-time').textContent();assert(eventText.includes('tick '+restored.tick),'Causal inspector showed a different tick');
  await page.getByRole('button',{name:'Close causal inspector'}).click();results.push({check:'same-tick causal inspector',event:eventText});
  for(const kind of ['odor','light']){
    const signals=[];
    for(const strength of [0,3]){
      const scene=clone(base);scene.name=kind+'-'+strength;scene.ducks[0].mode=kind;
      scene.props=[{id:'surface',kind:'wall',color:'#eeeeee',position:[.6,0,.2],size:[.05,1,.4]}];
      scene.fields=[{id:'field',kind,position:[.25,.25],strength,radius:.6}];
      await load(scene);const state=await run(.14);signals.push({strength,input:state.agents['duck-1'].input,brightness:state.agents['duck-1'].vision.brightness});
    }
    assert(signals[1].input.forward>signals[0].input.forward+.001,kind+' strength must change actual sensory drive');
    if(kind==='odor')assert(signals[1].input.turn>0,'Left odor field must create left sensory drive');
    results.push({check:kind+' field causal response',signals});
  }
  const challenge=clone(base);challenge.name='Prop goal challenge';challenge.ducks[0].silence='output';
  challenge.props=[{id:'ball-goal',name:'Goal ball',kind:'ball',position:[.5,.25,.08],size:[.12,.12,.12],movable:true,mass:.05}];
  challenge.challenge={duration:1,goal:[.5,.25],radius:.15,subject:'ball-goal'};
  await load(challenge);const final=await run(1);
  assert(final.paused&&final.time<1.05,'Challenge must stop at configured duration');
  assert(final.scores['ball-goal'].reachedAt!==null,'Physical prop goal was not scored');
  assert(final.props[0].position[2]<.08,'Movable prop must fall under gravity');
  results.push({check:'physical prop scoring and challenge auto-stop',time:final.time,score:final.scores['ball-goal'],prop:final.props[0]});
  await load({...base,name:'Final acceptance scene'});
  await page.getByText('Experiment tools',{exact:true}).click();
  await page.getByRole('button',{name:'Compare controllers',exact:true}).click();
  await page.getByRole('button',{name:'Save report',exact:true}).waitFor({timeout:180000});
  const reportDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Save report',exact:true}).click();
  await (await reportDownload).saveAs('docs/implementation/comparison-report.json');
  results.push({check:'matched comparison completed',report:await page.locator('#job-results').innerText()});
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.waitForFunction(()=>duckflyTelemetry.scene.name==='Final acceptance scene'&&duckflyTelemetry.time===0);
  results.push({check:'batch restores original arena'});
  await page.screenshot({path:'output/playwright/final-workspace-desktop.png'});
  return results;
}
