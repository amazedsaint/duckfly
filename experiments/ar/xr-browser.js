async page => {
 const errors=[],checks=[],check=(ok,message)=>{if(!ok)throw Error(message);};page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5195/');await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>window.duckflyTelemetry?.ready);
 const support=await page.evaluate(async()=>{
  const {XRDevice,metaQuest3}=await import('/node_modules/iwer/lib/index.js');
  const {SyntheticEnvironmentModule}=await import('/node_modules/@iwer/sem/lib/src/index.js');
  const device=new XRDevice({...metaQuest3,supportedFeatures:[...metaQuest3.supportedFeatures,'dom-overlay']},{stereoEnabled:false});
  device.installRuntime({forceInstall:true});device.installSEM(SyntheticEnvironmentModule);
  const environment=await fetch('/node_modules/@iwer/sem/captures/office_small.json').then(r=>r.json());device.sem.loadEnvironment(environment);
  device.position.set(0,1.6,0);device.quaternion.set(-Math.sin(Math.PI/8),0,0,Math.cos(Math.PI/8));
  device.canvasContainer.style.zIndex='1000';window.testXR=device;
  return{xr:await navigator.xr.isSessionSupported('immersive-ar'),planes:device.sem.trackedPlanes.size};
 });
 await page.locator('#launch-enter').click();await page.locator('#new-ar-scene').click();await page.locator('#ar-start').click();
 await page.waitForFunction(()=>document.querySelector('#ar-view').dataset.tracking==='true',null,{timeout:20000});
 await page.waitForFunction(()=>!document.querySelector('#ar-place').disabled,null,{timeout:15000});
 await page.screenshot({path:'output/playwright/ar-emulated-placement.png'});
 await page.locator('#ar-place').click();await page.waitForFunction(()=>window.duckflyTelemetry.tick>=100,null,{timeout:45000});
 await page.locator('#ar-run').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);
 await page.screenshot({path:'output/playwright/ar-emulated-running.png'});
 const sample=()=>page.evaluate(()=>{const t=window.duckflyTelemetry,a=t.agents['duck-1'];return{tick:t.tick,ducks:t.ducks,vision:a.vision,input:a.input,neural:a.neural};});
 await page.locator('#ar-tools > summary').click();
 await page.locator('#ar-scale').selectOption('0.5');
 await page.locator('#ar-rotate').click();await page.locator('#ar-rotate').click();
 await page.locator('#ar-reset').click();await page.waitForFunction(()=>window.duckflyTelemetry.tick===0&&window.duckflyTelemetry.paused);
 for(let i=1;i<=20;i++){await page.locator('#ar-step').click();await page.waitForFunction(tick=>window.duckflyTelemetry.tick===tick,i*5);}
 const xr=await sample();check(xr.ducks[0].distance>.15&&!xr.ducks[0].fallen,'XR walking failed');
 await page.locator('#ar-run').click();await page.waitForFunction(()=>window.duckflyTelemetry.tick>110);
 await page.evaluate(()=>window.testXR.updateVisibilityState('hidden'));
 await page.waitForFunction(()=>window.duckflyTelemetry.paused&&document.querySelector('#ar-view').dataset.tracking==='false');
 const held=await page.evaluate(()=>window.duckflyTelemetry.tick);await page.waitForTimeout(150);
 check(await page.evaluate(()=>window.duckflyTelemetry.tick)===held,'Hidden XR session advanced physics');
 await page.evaluate(()=>window.testXR.updateVisibilityState('visible'));await page.waitForFunction(()=>document.querySelector('#ar-view').dataset.tracking==='true');
 check(await page.evaluate(()=>window.duckflyTelemetry.paused),'Tracking restoration auto-ran the duck');
 checks.push({name:'tracking loss pauses, recovery waits for Run',tick:held});
 // IWER 2.4 snapshots the viewer's full tilt into a new local space. Start
 // each session upright so its local Y axis matches gravity, as WebXR specifies.
 await page.evaluate(()=>{window.testXR.quaternion.set(0,0,0,1);return new Promise(resolve=>window.testXR.activeSession.requestAnimationFrame(()=>resolve()));});
 await page.locator('#ar-exit').click();await page.waitForFunction(()=>document.querySelector('#ar-view').hidden&&!window.testXR.activeSession);
 check(await page.locator('#arena > canvas').count()===1&&await page.locator('#brain-panel #brain-plot').count()===1,'AR did not return the stage and monitor');
 await page.locator('#reset').click();await page.waitForFunction(()=>window.duckflyTelemetry.tick===0);
 for(let i=1;i<=20;i++){await page.locator('#step').click();await page.waitForFunction(tick=>window.duckflyTelemetry.tick===tick,i*5);}
 const studio=await sample();
 const equal=JSON.stringify(xr)===JSON.stringify(studio);
 check(equal,'AR changed the virtual eye, neural state or physical simulation');
 checks.push({name:'rotated, half-scale XR and studio produce identical vision, neural state and body at tick 100',distance:studio.ducks[0].distance});
 await page.locator('#view-ar').click();await page.locator('#ar-start').click();
 await page.waitForFunction(()=>document.querySelector('#ar-view').dataset.tracking==='true');
 await page.evaluate(()=>window.testXR.quaternion.set(-Math.sin(Math.PI/8),0,0,Math.cos(Math.PI/8)));
 await page.waitForFunction(()=>!document.querySelector('#ar-place').disabled);
 await page.locator('#ar-place').click();await page.locator('#ar-run').click();
 await page.waitForFunction(()=>window.duckflyTelemetry.paused);
 if(!await page.locator('#ar-tools').evaluate(el=>el.open))await page.locator('#ar-tools > summary').click();
 await page.evaluate(()=>{window.testXR.position.x+=.8;});
 await page.waitForTimeout(150);
 await page.locator('#ar-kind').selectOption('ball');await page.locator('#ar-profile').selectOption('pushable');
 await page.locator('#ar-add').click();await page.locator('#ar-place').click();
 await page.waitForFunction(()=>window.duckflyTelemetry.scene.props.some(p=>p.id==='ball-1'));
 const ball=await page.evaluate(()=>window.duckflyTelemetry.scene.props.find(p=>p.id==='ball-1'));
 check(ball.movable&&Math.hypot(...ball.position.slice(0,2))>.5,'XR hit did not place a physical ball away from the origin');
 await page.locator('#ar-kind').selectOption('odor');await page.locator('#ar-add').click();await page.locator('#ar-place').click();
 await page.waitForFunction(()=>window.duckflyTelemetry.scene.fields.some(f=>f.kind==='odor'));
 checks.push({name:'rapid placement pause and second XR session; add a pushable ball and a scent source from hit tests',ball});
 await page.locator('#ar-exit').click();await page.waitForFunction(()=>document.querySelector('#ar-view').hidden&&!window.testXR.activeSession);
 await page.evaluate(()=>{navigator.xr.requestSession=async()=>{throw new DOMException('Required features unavailable','NotSupportedError');};});
 await page.locator('#view-ar').click();await page.locator('#ar-start').click();
 await page.waitForFunction(()=>document.querySelector('#ar-dialog').open&&document.querySelector('#ar-support').textContent.includes('could not start surface AR'));
 check(await page.locator('#arena > canvas').count()===1&&!await page.locator('#app').evaluate(el=>el.inert),'XR refusal stranded the studio');
 await page.locator('#ar-cancel').click();
 checks.push({name:'unsupported required XR features return to a usable mode picker'});
 check(!errors.length,'XR errors: '+errors.join('; '));
 return{format:'duckfly-xr-continuity',passed:equal,support,checks,errors,xr,studio};
}
