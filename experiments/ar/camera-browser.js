async page => {
 const errors=[],checks=[],check=(ok,message)=>{if(!ok)throw Error(message);};page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5195/');await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>window.duckflyTelemetry?.ready);
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=960;const ctx=canvas.getContext('2d');
  const paint=()=>{ctx.fillStyle='#c3b99a';ctx.fillRect(0,0,640,960);ctx.fillStyle='#eff0df';ctx.fillRect(0,0,640,460);ctx.fillStyle='#a0b9a3';ctx.fillRect(45,220,210,230);ctx.fillStyle='#777363';for(let x=0;x<800;x+=160)ctx.fillRect(x,460,2,500);for(let y=470;y<960;y+=140)ctx.fillRect(0,y,640,2);};paint();
  window.testCameraPaint=setInterval(paint,100);window.testCameraStreams=[];
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const stream=canvas.captureStream(10);window.testCameraStreams.push(stream);return stream;}});
 });
 await page.locator('#launch-enter').click();await page.locator('#new-ar-scene').click();await page.locator('#ar-camera').click();
 await page.waitForFunction(()=>document.querySelector('#ar-view').dataset.tracking==='true');
 await page.locator('#ar-place').click();await page.waitForFunction(()=>window.duckflyTelemetry.tick>=150,null,{timeout:45000});
 await page.locator('#ar-run').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);
 await page.screenshot({path:'output/playwright/ar-camera-phone.png'});

 check(await page.locator('#brain-plot').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight),'Brain is not visible in camera preview');
 checks.push({name:'camera preview runs the real neural and physical simulation',distance:await page.evaluate(()=>window.duckflyTelemetry.ducks[0].distance)});
 await page.locator('#ar-viewport > canvas').click({position:{x:55,y:365}});
 await page.locator('#ar-tools > summary').click();
 await page.locator('#ar-kind').selectOption('ball');await page.locator('#ar-profile').selectOption('pushable');
 await page.locator('#ar-add').click();await page.locator('#ar-place').click();
 await page.waitForFunction(()=>window.duckflyTelemetry.scene.props.some(p=>p.id==='ball-1'));
 check(await page.evaluate(()=>window.duckflyTelemetry.scene.props.find(p=>p.id==='ball-1').movable),'Placed ball lacks physics');
 await page.locator('#ar-object').selectOption('ball-1');await page.locator('#ar-profile').selectOption('fixed');await page.locator('#ar-physics').click();
 await page.waitForFunction(()=>window.duckflyTelemetry.scene.props.find(p=>p.id==='ball-1').movable===false);
 await page.locator('#ar-profile').selectOption('heavy');await page.locator('#ar-physics').click();
 await page.waitForFunction(()=>window.duckflyTelemetry.scene.props.find(p=>p.id==='ball-1').mass===1);
 await page.locator('#ar-tools > summary').click();
 await page.locator('#ar-viewport > canvas').click({position:{x:170,y:310}});
 await page.locator('#ar-tools > summary').click();await page.locator('#ar-kind').selectOption('duck');
 await page.locator('#ar-add').click();await page.locator('#ar-place').click();
 await page.waitForFunction(()=>window.duckflyTelemetry.scene.ducks.length===2);
 check(await page.locator('#ar-duck').inputValue()==='duck-2','Added duck is not connected to the AR brain monitor');
 await page.locator('#ar-duck').selectOption('duck-1');
 await page.waitForFunction(()=>window.duckflyTelemetry.connectedDuck==='duck-1');
 checks.push({name:'place a ball, change its weight, add an independent duck and select its brain',scene:await page.evaluate(()=>window.duckflyTelemetry.scene)});
 for(const [width,height]of [[390,844],[320,740],[844,390]]){
  await page.setViewportSize({width,height});
  const layout=await page.locator('#ar-view').evaluate(el=>({overflow:el.scrollWidth>innerWidth+1,brain:document.querySelector('#brain-plot').getBoundingClientRect().toJSON()}));
  check(!layout.overflow&&layout.brain.right<=width&&layout.brain.bottom<=height,'AR layout failed at '+width);
  await page.screenshot({path:'output/playwright/ar-camera-controls-'+width+'.png'});
 }
 await page.locator('#ar-exit').click();await page.waitForFunction(()=>document.querySelector('#ar-view').hidden);
 check(await page.evaluate(()=>window.testCameraStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),'Camera kept running after exit');
 check(await page.locator('#arena > canvas').count()===1&&await page.locator('#brain-panel #brain-plot').count()===1,'Stage or monitor was not restored');
 await page.evaluate(()=>clearInterval(window.testCameraPaint));
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Denied','NotAllowedError');}}));
 await page.locator('#view-ar').click();await page.locator('#ar-camera').click();
 await page.waitForFunction(()=>document.querySelector('#ar-dialog').open&&document.querySelector('#ar-support').textContent.includes('permission was declined'));
 check(await page.locator('#arena > canvas').count()===1,'Camera refusal stranded the renderer');
 await page.locator('#ar-cancel').click();
 checks.push({name:'exit stops every camera track; permission refusal preserves the studio'});
 check(!errors.length,'Camera preview errors: '+errors.join('; '));
 return{format:'duckfly-camera-ar-acceptance',passed:true,video:'synthetic canvas stream; no device camera used',checks,errors};
}
