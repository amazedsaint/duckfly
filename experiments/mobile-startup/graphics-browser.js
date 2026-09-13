async page => {
  const origin=await page.evaluate(()=>location.origin),tab=await page.context().newPage(),errors=[];
  try {
    tab.on('pageerror',error=>errors.push(error.message));
    await tab.addInitScript(()=>{
      const OriginalWorker=Worker;
      window.Worker=class extends OriginalWorker {
        constructor(...args){
          super(...args);
          this.addEventListener('message',event=>{
            if(event.data.type==='vision-request'&&window.loseOnNextFrame){
              window.loseOnNextFrame=false;
              window.loss=document.querySelector('#arena canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
              window.loss.loseContext();
            }
          });
        }
        postMessage(message,...rest){
          if(message.type==='frames-error')window.rejectedFrames=(window.rejectedFrames??0)+1;
          return super.postMessage(message,...rest);
        }
      };
    });
    await tab.goto(origin+'/?ar=1');
    await tab.waitForFunction(()=>window.duckflyTelemetry?.ready);
    await tab.locator('#ar-cancel').click();
    await tab.evaluate(()=>{window.loseOnNextFrame=true;});
    await tab.locator('#pause').click();
    await tab.waitForFunction(()=>!document.querySelector('#loading').hidden&&window.duckflyTelemetry.paused&&window.rejectedFrames>0);
    const paused=await tab.evaluate(()=>({tick:window.duckflyTelemetry.tick,rejectedFrames:window.rejectedFrames}));
    if(paused.tick!==0)throw Error('A missing graphics frame advanced the experiment');
    await tab.evaluate(()=>loss.restoreContext());
    await tab.waitForFunction(()=>document.querySelector('#loading').hidden);
    await tab.locator('#pause').click();
    await tab.waitForFunction(()=>window.duckflyTelemetry.tick>50);
    await tab.locator('#pause').click();await tab.waitForFunction(()=>window.duckflyTelemetry.paused);
    const resumed=await tab.evaluate(()=>({tick:window.duckflyTelemetry.tick,fallen:window.duckflyTelemetry.ducks[0].fallen}));
    if(resumed.fallen||errors.length)throw Error('Graphics recovery failed: '+errors.join('; '));
    return{format:'duckfly-graphics-recovery',passed:true,origin,paused,resumed,errors};
  } finally { await tab.close(); }
}
